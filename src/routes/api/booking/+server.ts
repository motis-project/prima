import { Validator } from 'jsonschema';
import { sql } from 'kysely';
import { bookingSchema, schemaDefinitions } from '../whitelist/WhitelistRequest';
import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { bookRide, type ExpectedConnection } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/server/booking/Capacities';
import { insertRequest } from './query';
import { json } from '@sveltejs/kit';

export type BookingParameters = {
	connection1: ExpectedConnection;
	connection2: ExpectedConnection | null;
	capacities: Capacities;
};

const getCommonTour = (l1: Set<number>, l2: Set<number>) => {
	for (const e of l1) {
		if (l2.has(e)) {
			return e;
		}
	}
	return undefined;
};

export const POST = async (event: RequestEvent) => {
	const customer = event.locals.session!.userId!;

	const p: BookingParameters = await event.request.json();
	const validator = new Validator();
	validator.addSchema(schemaDefinitions, '/schemaDefinitions');
	const result = validator.validate(p, bookingSchema);
	if (!result.valid) {
		return json({ message: result.errors }, { status: 400 });
	}
	let firstMileRequestId: number | undefined = undefined;
	let lastMileRequestId: number | undefined = undefined;
	let message: string | undefined = undefined;
	let success = false;
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE tour, request, event, availability IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		let firstConnection = undefined;
		let secondConnection = undefined;
		if (p.connection1 != null) {
			firstConnection = await bookRide(p.connection1, p.capacities, false, trx);
			if (firstConnection == undefined) {
				message = 'Die erste Anfrage kann nicht erfüllt werden.';
				return;
			}
		}
		if (p.connection2 != null) {
			secondConnection = await bookRide(p.connection2, p.capacities, true, trx);
			if (secondConnection == undefined) {
				message = 'Die zweite Anfrage kann nicht erfüllt werden.';
				return;
			}
		}
		if (
			p.connection1 != null &&
			p.connection2 != null &&
			firstConnection!.tour != undefined &&
			secondConnection!.tour != undefined
		) {
			const newTour = getCommonTour(
				firstConnection!.mergeTourList,
				secondConnection!.mergeTourList
			);
			if (newTour != undefined) {
				firstConnection!.tour = newTour;
				secondConnection!.tour = newTour;
			}
		}
		if (p.connection1 != null) {
			firstMileRequestId =
				(await insertRequest(
					firstConnection!.best,
					p.capacities,
					p.connection1,
					customer,
					firstConnection!.eventGroupUpdateList,
					[...firstConnection!.mergeTourList],
					firstConnection!.pickupEventGroup,
					firstConnection!.dropoffEventGroup,
					firstConnection!.neighbourIds,
					firstConnection!.directDurations,
					trx
				)) ?? null;
		}
		if (p.connection2 != null) {
			lastMileRequestId =
				(await insertRequest(
					secondConnection!.best,
					p.capacities,
					p.connection2,
					customer,
					secondConnection!.eventGroupUpdateList,
					[...secondConnection!.mergeTourList],
					secondConnection!.pickupEventGroup,
					secondConnection!.dropoffEventGroup,
					secondConnection!.neighbourIds,
					secondConnection!.directDurations,
					trx
				)) ?? null;
		}
		message = 'Die Anfrage wurde erfolgreich bearbeitet.';
		success = true;
		return;
	});
	if (message == undefined) {
		return json({ status: 500 });
	}
	return json({ message, firstMileRequestId, lastMileRequestId }, { status: success ? 200 : 400 });
};
