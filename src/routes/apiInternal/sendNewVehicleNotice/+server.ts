import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { MINUTE } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import NewVehicleNotification from '$lib/server/email/NewVehicleNotification.svelte';

export const POST = async (_: RequestEvent) => {
	console.log('Sending NewVechicleNotices.');
	const now = Date.now();
	await db.transaction().execute(async (trx) => {
		const requests = await trx
			.selectFrom('request')
			.innerJoin('user', 'user.id', 'request.customer')
			.innerJoin('tour', 'tour.id', 'request.tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('event', 'event.request', 'request.id')
			.where('licensePlateUpdatedAt', 'is not', null)
			.where('event.isPickup', '=', true)
			.where('event.communicatedTime', '>', now - 15 * MINUTE)
			.where('event.communicatedTime', '<', now + 15 * MINUTE)
			.where('request.cancelled', '=', false)
			.where('user.isService', '=', false)
			.select((eb) => [
				'user.firstName',
				'user.name',
				'user.email',
				'request.id as requestId',
				'vehicle.licensePlate',
				'tour.id as tourId',
				jsonArrayFrom(
					eb
						.selectFrom('event')
						.whereRef('event.request', '=', 'request.id')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.select(['event.communicatedTime', 'eventGroup.address'])
				).as('events')
			])
			.execute();
		for (const request of requests) {
			try {
				console.log('Sending NewVehicleNotification to ', request.email);
				await sendMail(NewVehicleNotification, 'Fahrzeugwechsel', request.email, {
					events: request.events,
					name: request.firstName + ' ' + request.name,
					newLicensePlate: request.licensePlate
				});
			} catch {
				console.log(
					'Failed to send NewVehicleNotification to customer with email: ',
					request.email,
					' tourId: ',
					request.tourId
				);
			}
		}
		if (requests.length === 0) {
			return;
		}
		const requestIds = requests.map((r) => r.requestId);
		await trx
			.updateTable('request')
			.set({ licensePlateUpdatedAt: null })
			.where('id', 'in', requestIds)
			.execute();
	});
	return json({});
};
