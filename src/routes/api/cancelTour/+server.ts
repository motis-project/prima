import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCustomer from '$lib/server/email/CancelNotificationCustomer.svelte';
import { jsonArrayFrom } from 'kysely/helpers/postgres';

export const POST = async (event: RequestEvent) => {
	const company = event.locals.session!.companyId;
	const p = await event.request.json();
	if (!company || !p.tourId || p.message == null || p.message == undefined) {
		return json({});
	}
	await sql`CALL cancel_tour(${p.tourId}, ${company}, ${p.message})`.execute(db);
	const tour = await db
		.selectFrom('tour')
		.where('tour.id', '=', p.tourId)
		.select((eb) => [
			jsonArrayFrom(
				eb
					.selectFrom('request')
					.innerJoin('user', 'user.id', 'request.customer')
					.whereRef('tour.id', '=', 'request.tour')
					.select((eb) => [
						'user.email',
						'user.name',
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
		return json({});
	}
	console.assert(tour.requests.length != 0, 'Found a tour with no requests');
	for (const request of tour.requests) {
		console.assert(request.events.length != 0, 'Found a request with no events');
		try {
			await sendMail(CancelNotificationCustomer, 'Stornierte Buchung', request.email, {
				start: request.events[0].address,
				to: request.events[1].address,
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
	return json({});
};
