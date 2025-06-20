import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { MINUTE } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import NewVehicleNotification from '$lib/server/email/NewVehicleNotification.svelte';
import { lockTablesStatement } from '$lib/server/db/lockTables';

export const POST = async (_: RequestEvent) => {
	const t = Date.now() - MINUTE;
	console.log('Sending NewVechicleNotices.');
	const now = Date.now();
	await db.transaction().execute(async (trx) => {
		await lockTablesStatement(['request', 'user', 'tour', 'vehicle', 'event']).execute(trx);
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
				'request.id as requestId',
				'vehicle.licensePlate',
				'tour.id as tourId',
				jsonArrayFrom(
					eb
						.selectFrom('event')
						.whereRef('event.request', '=', 'request.id')
						.select(['event.communicatedTime', 'event.address'])
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

			request.events.sort((e1, e2) => e1.communicatedTime - e2.communicatedTime);
			const startTime = request.events[0].communicatedTime;
			const endTime = request.events[request.events.length - 1].communicatedTime;
			const today = new Date(Date.now());
			const startDate = new Date(startTime);
			const endDate = new Date(endTime);
			const firstEventDate = new Date(request.events[0].communicatedTime);
			const isStartToday =
				new Date(
					firstEventDate.getUTCFullYear(),
					firstEventDate.getUTCMonth(),
					firstEventDate.getUTCDate()
				).getTime() ===
				new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()).getTime();

			console.log(`Guten Tag ${request.name},
		<li>von ${request.events[0].address}</li>
		<li>nach ${request.events[request.events.length - 1].address}
		die
		${isStartToday ? 'heute' : 'am ' + startDate!.toLocaleDateString('de')} von
		${startDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} bis
		${endDate!.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} geplant ist gab es Änderungen.
		Die Taxifahrt wird von einem anderen Fahrzeug mit dem Kennzeichen ${request.licensePlate} durchgeführt.`);
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
