import { env } from '$env/dynamic/public';
import { plan, type Itinerary, type PlanData } from '$lib/openapi';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { fail, json, type RequestEvent } from '@sveltejs/kit';
import { getRideShareInfos } from '$lib/server/booking/rideShare/getRideShareInfo';
import { isOdmLeg } from '$lib/util/booking/checkLegType';
import { filterRideSharing } from '$lib/util/filterRideSharing';
import { db } from '$lib/server/db';
import { filterTaxis } from '$lib/util/filterTaxis';
import { readTimeFromPageCursor } from '$lib/util/time';

export const POST = async (event: RequestEvent) => {
	const q: PlanData['query'] = await event.request.json();
	const r = await plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: q
	});
	const response = r.data;
	console.log('Plan Request', r.request);
	if (response === undefined) {
		return fail(500);
	}

	response.itineraries = filterRideSharing(response.itineraries);

	const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
	if (filterSettings === undefined) {
		return fail(500);
	}

	let filteredItineraries = event.locals.session?.isAdmin
		? response.itineraries
		: filterTaxis(
				response.itineraries,
				filterSettings.perTransfer,
				filterSettings.taxiBase,
				filterSettings.taxiPerMinute,
				filterSettings.taxiDirectPenalty,
				filterSettings.ptSlope,
				filterSettings.taxiSlope
			).itineraries;

	const intvl_start = readTimeFromPageCursor(response.previousPageCursor);
	const intvl_end = readTimeFromPageCursor(response.nextPageCursor);
	filteredItineraries = filteredItineraries.filter((i) => {
		const t = new Date(q.arriveBy ? i.endTime : i.startTime);
		return intvl_start <= t && t <= intvl_end;
	});

	return json({
		...response!,
		itineraries: await Promise.all(
			filteredItineraries.map(async (i: Itinerary) => {
				const odmLeg1 = i.legs.find(isOdmLeg);
				const odmLeg2 = i.legs.findLast(isOdmLeg);
				const rideShareTourInfos = await getRideShareInfos(i);
				return {
					...i,
					signature1:
						odmLeg1 !== undefined
							? signEntry(
									odmLeg1.from.lat,
									odmLeg1.from.lon,
									odmLeg1.to.lat,
									odmLeg1.to.lon,
									new Date(odmLeg1.startTime).getTime(),
									new Date(odmLeg1.endTime).getTime(),
									false,
									odmLeg1.tripId
								)
							: undefined,
					signature2:
						odmLeg2 !== undefined
							? signEntry(
									odmLeg2.from.lat,
									odmLeg2.from.lon,
									odmLeg2.to.lat,
									odmLeg2.to.lon,
									new Date(odmLeg2.startTime).getTime(),
									new Date(odmLeg2.endTime).getTime(),
									true,
									odmLeg2.tripId
								)
							: undefined,
					rideShareTourInfos
				};
			})
		)
	});
};
