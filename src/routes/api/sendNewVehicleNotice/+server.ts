import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { MINUTE } from '$lib/util/time';
import { json } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import NewVehicleNotification from '$lib/server/email/NewVehicleNotification.svelte';
import { sql } from 'kysely';
import { error } from '@sveltejs/kit';
import { INTERNAL_API_TOKEN } from '$env/static/private';

export const POST = async (event) => {
	const token = event.request.headers.get('internal-token');
	if (token !== INTERNAL_API_TOKEN) {
		console.log('Unauthorized access of sendNewVehicleNotice endpoint');
		error(403);
	}
	const t = Date.now() - MINUTE;
	console.log('Sending NewVechicleNotices.');
	const now = Date.now();
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE request IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const requests = await trx
			.selectFrom('request')
			.innerJoin('user', 'user.id', 'request.customer')
			.innerJoin('tour', 'tour.id', 'request.tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('event', 'event.request', 'request.id')
			.where('licensePlateUpdatedAt', 'is not', null)
			.where('licensePlateUpdatedAt', '>=', t)
			.where('event.isPickup', '=', true)
			.where('event.communicatedTime', '>', now - 15 * MINUTE)
			.where('event.communicatedTime', '<', now + 15 * MINUTE)
			.where('request.cancelled', '=', false)
			.select((eb) => [
				'user.name',
				'user.email',
				'user.id',
				'vehicle.licensePlate',
				'tour.id as tourId',
				jsonArrayFrom(
					eb
						.selectFrom('event')
						.whereRef('event.request', '=', 'request.id')
						.select(['event.communicatedTime'])
				).as('events')
			])
			.execute();
		for (const request of requests) {
			try {
				console.log('Sending NewVehicleNotification to ', request.email);
				await sendMail(NewVehicleNotification, 'Fahrzeugwechsel', request.email, {
					events: request.events,
					name: request.name,
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
		const requestIds = requests.map((r) => r.id);
		if (requestIds.length === 0) {
			return;
		}
		await trx
			.updateTable('request')
			.set({ licensePlateUpdatedAt: null })
			.where('id', 'in', requestIds)
			.execute();
	});
	return json({});
};
