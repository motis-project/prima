import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { error, json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCustomer from '$lib/server/email/CancelNotificationCustomer.svelte';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

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
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE tour, request, event, "user" IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const tour = await trx
			.selectFrom('tour')
			.where('tour.id', '=', p.tourId)
			.select((eb) => [
				'tour.fare',
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('user', 'user.id', 'request.customer')
						.whereRef('tour.id', '=', 'request.tour')
						.select((eb) => [
							'user.email',
							'user.name',
							'request.ticketChecked',
							jsonArrayFrom(
								eb
									.selectFrom('event')
									.whereRef('event.request', '=', 'request.id')
									.orderBy('isPickup', 'asc')
									.select(['event.address', 'event.communicatedTime'])
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
		console.assert(tour.requests.length != 0, 'Found a tour with no requests');
		for (const request of tour.requests) {
			console.assert(request.events.length != 0, 'Found a request with no events');
			try {
				await sendMail(CancelNotificationCustomer, 'Stornierte Buchung', request.email, {
					start: request.events[0].address,
					target: request.events[1].address,
					startTime: request.events[0].communicatedTime,
					name: request.name
				});
			} catch {
				console.log(
					'Failed to send cancellation email to customer with email: ',
					request.email,
					' tourId: ',
					p.tourId
				);
				return json({});
			}
		}
	});
	console.log('Cancel Tour succes. tourId: ', p.tour);
	return json({});
};
