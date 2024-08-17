import { error, json } from '@sveltejs/kit';
import {} from '$lib/utils.js';
import { bookingQuery, getBookingIssues } from './queries.js';
import { db } from '$lib/database.js';
import { sql } from 'kysely';

export const POST = async (event): Promise<Response> => {
	const customer = event.locals.user;
	if (!customer) {
		return error(403);
	}
	const customerId = customer.id;
	const request = event.request;
	const {
		from,
		to,
		startTime,
		targetTime,
		numPassengers,
		numWheelchairs,
		numBikes,
		luggage,
		bestCompany
	} = await request.json();
	let q: Response | undefined = undefined;
	await db.transaction().execute(async (trx) => {
		sql`LOCK TABLE availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		q = await getBookingIssues(
			from,
			to,
			startTime,
			targetTime,
			numPassengers,
			numWheelchairs,
			numBikes,
			luggage,
			customerId,
			bestCompany
		);
		if (q == undefined) {
			await bookingQuery(
				trx,
				from,
				to,
				startTime,
				targetTime,
				numPassengers,
				numWheelchairs,
				numBikes,
				luggage,
				customerId,
				bestCompany
			);
			q = json({ status: 1, message: 'Buchung erfolgreich.' }, { status: 200 });
		}
	});
	return q!;
};
