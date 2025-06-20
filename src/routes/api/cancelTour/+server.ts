import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { error, json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCustomer from '$lib/server/email/CancelNotificationCustomer.svelte';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { lockTablesStatement } from '$lib/server/db/lockTables';
import { sendNotifications } from '$lib/server/firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';

export const POST = async (event: RequestEvent) => {
	const company = event.locals.session!.companyId;
	const p = await event.request.json();
	console.log(
		'Cancel Tour PARAMS START: ',
		JSON.stringify(p, null, '\t'),
		{ company },
		'Cancel Tour PARAMS END'
	);
	if (!company || !p.tourId || p.message == null || p.message == undefined) {
		console.log('Cancel Tour early exit - invalid params tourId: ', p.tour);
		return json({});
	}
	let emails = new Array<Promise<void>>();
	let notifications = undefined;
	await db.transaction().execute(async (trx) => {
		await lockTablesStatement(['tour', 'request', 'event', 'user', 'vehicle']).execute(trx);
		const tour = await trx
			.selectFrom('tour')
			.where('tour.id', '=', p.tourId)
			.select((eb) => [
				'tour.fare',
				'tour.vehicle',
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('user', 'user.id', 'request.customer')
						.whereRef('tour.id', '=', 'request.tour')
						.select((eb) => [
							'user.email',
							'user.name',
							'request.ticketChecked',
							'request.wheelchairs',
							jsonArrayFrom(
								eb
									.selectFrom('event')
									.whereRef('event.request', '=', 'request.id')
									.orderBy('isPickup', 'desc')
									.select([
										'event.address',
										'event.communicatedTime',
										'event.scheduledTimeStart',
										'event.scheduledTimeEnd',
										'isPickup'
									])
							).as('events')
						])
				).as('requests')
			])
			.executeTakeFirst();
		if (tour === undefined) {
			console.log('Cancel Tour early exit - cannot find Tour in Database. tourId: ', p.tour);
			return json({});
		}
		if (tour.requests.some((r) => r.ticketChecked)) {
			console.log('Cancel Tour early exit - Tour had scanned ticket. tourId: ', p.tour);
			error(400, {
				message: 'Es wurde bereits ein Ticket gescannt - die Tour kann nicht storniert werden.'
			});
		}
		if (tour.fare !== null) {
			console.log('Cancel Tour early exit - fare was already registered. tourId: ', p.tour);
			error(400, {
				message:
					'Der Taxameterstand wurde bereits eingetragen - die Tour kann nicht storniert werden.'
			});
		}
		await sql`CALL cancel_tour(${p.tourId}, ${company}, ${p.message})`.execute(trx);

		emails = tour.requests.map((request) =>
			sendMail(CancelNotificationCustomer, 'Stornierte Buchung', request.email, {
				start: request.events[0].address,
				target: request.events[1].address,
				startTime: request.events[0].communicatedTime,
				name: request.name
			}).catch(() =>
				console.log(
					'Failed to send cancellation email to customer with email: ',
					request.email,
					' tourId: ',
					p.tourId
				)
			)
		);

		const firstEvent = tour.requests.flatMap((r) => r.events).sort((e) => e.scheduledTimeStart)[0];
		const wheelchairs = tour.requests.reduce((prev, curr) => prev + curr.wheelchairs, 0);
		notifications = sendNotifications(company, {
			tourId: p.tourId,
			pickupTime: getScheduledEventTime(firstEvent),
			vehicleId: tour.vehicle,
			wheelchairs,
			change: TourChange.CANCELLED
		});
	});
	if (notifications) {
		await notifications;
	}
	Promise.all(emails);
	console.log('Cancel Tour succes. tourId: ', p.tour);
	return json({});
};
