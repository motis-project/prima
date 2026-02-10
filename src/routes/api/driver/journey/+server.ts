import { db, type Database } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { ReferenceExpression } from 'kysely';

type Journey = Awaited<ReturnType<typeof query>>;

const query = async (name: ReferenceExpression<Database, 'journey'>, requestId: number) => {
	const itinerary = await db
		.selectFrom('journey')
		.where(name, '=', requestId)
		.innerJoin('request', 'request.id', 'journey.request1')
		.innerJoin('tour', 'request.tour', 'journey.request1')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.select(['journey.json', 'vehicle.company'])
		.executeTakeFirst();

	return itinerary;
};

const filter = (journey: Journey, companyId: number, isRequest1: boolean) => {
	if (journey == undefined) {
		console.log('driver/journey: filter: invalid parameter: journey=undefined');
		return undefined;
	}

	if (journey.company != companyId) {
		console.log('driver/journey: filter: invalid parameter: companyId=undefined');
		return undefined;
	}

	if (journey.json.legs.length == 1) {
		console.log('driver/journey: filter: no legs in journey');
		return undefined;
	}

	const modifiedLegs = journey.json.legs
		.filter((l) => l.mode != 'WALK')
		.map((e) => ({
			mode: e.mode,
			from: e.from,
			to: e.to,
			duration: e.duration,
			startTime: e.startTime,
			endTime: e.endTime,
			scheduledStartTime: e.scheduledStartTime,
			scheduledEndTime: e.scheduledEndTime,
			realTime: e.realTime,
			scheduled: e.scheduled,
			headsign: e.headsign,
			tripTo: e.tripTo,
			routeColor: e.routeColor,
			routeTextColor: e.routeTextColor,
			tripId: e.tripId,
			routeShortName: e.routeShortName,
			routeLongName: e.routeLongName,
			tripShortName: e.tripShortName,
			displayName: e.displayName,
			cancelled: e.cancelled,
			intermediateStops: e.intermediateStops
		}));

	if (modifiedLegs.length == 0) {
		console.log('driver/journey: filter: no PT legs in journey');
		return undefined;
	}

	const odmLegIndex1 = modifiedLegs.findIndex((e) => e.mode == 'ODM');
	const odmLegIndex2 = modifiedLegs.findLastIndex((e) => e.mode == 'ODM');

	let ptLeg = modifiedLegs[0];

	if (isRequest1) {
		if (odmLegIndex1 == 0) {
			// drop off
			ptLeg = modifiedLegs[odmLegIndex1 + 1];
		} else {
			// pick up
			ptLeg = modifiedLegs[odmLegIndex1 - 1];
		}
	} else {
		// pick up
		ptLeg = modifiedLegs[odmLegIndex2 - 1];
	}

	return json(ptLeg);
};

export const GET = async ({ url, locals }) => {
	const companyId = locals.session!.companyId!;
	const requestId = readInt(url.searchParams.get('requestId'));

	if (isNaN(requestId)) {
		error(400, { message: 'Invalid requestId parameter' });
	}

	const journey1 = await query('request1', requestId);
	const journey2 = await query('request2', requestId);

	return (
		filter(journey1, companyId, true) ??
		filter(journey2, companyId, false) ??
		new Response(null, { status: 404 })
	);
};
