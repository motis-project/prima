import { env } from '$env/dynamic/public';
import { plan, type Itinerary, type PlanData } from '$lib/openapi';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { error, json, type RequestEvent } from '@sveltejs/kit';
import { getRideShareInfos } from '$lib/server/booking/rideShare/getRideShareInfo';
import { isOdmLeg, isRideShareLeg } from '$lib/util/booking/checkLegType';
import { filterRideSharing } from '$lib/util/filterRideSharing';
import { db } from '$lib/server/db';
import { filterTaxis } from '$lib/util/filterTaxis';
import { readTimeFromPageCursor } from '$lib/util/time';
import { publicTransitOnly } from '$lib/util/itineraryHelpers';
import Prom from 'prom-client';

let plan_requests: Prom.Counter | undefined;
let plan_from: Prom.Counter | undefined;
let plan_to: Prom.Counter | undefined;
let result_itineraries: Prom.Histogram | undefined;
let query_duration: Prom.Histogram | undefined;
try {
	plan_requests = new Prom.Counter({
		name: 'prima_plan_requests_total',
		help: 'Request count'
	});
	plan_from = new Prom.Counter({
		name: 'prima_plan_from_total',
		help: 'Routing request from',
		labelNames: ['lat', 'lon']
	});
	plan_to = new Prom.Counter({
		name: 'prima_plan_to_total',
		help: 'Routing request to',
		labelNames: ['lat', 'lon']
	});
	result_itineraries = new Prom.Histogram({
		name: 'prima_plan_result_itineraries',
		help: 'Types of itineraries shown to the user',
		labelNames: ['type', 'only'],
		buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30]
	});
	query_duration = new Prom.Histogram({
		name: 'prima_plan_query_duration_seconds',
		help: 'Query duration',
		buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30]
	});
} catch {
	/* ignored */
}

export const POST = async (event: RequestEvent) => {
	plan_requests?.inc();
	const timer = query_duration?.startTimer();
	const q: PlanData['query'] = await event.request.json();
	const r = await plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: q
	});
	const response = r.data;
	console.log('Plan Request', r.request);
	if (response === undefined) {
		if (r.response.status == 400 && timer) {
			timer();
		}
		error(r.response.status, { message: r.error.error || 'Unknown Error' });
	}

	response.itineraries = filterRideSharing(response.itineraries);

	const intvl_start = readTimeFromPageCursor(response.previousPageCursor);
	const intvl_end = readTimeFromPageCursor(response.nextPageCursor);

	if (event.locals.session?.isAdmin) {
		response.itineraries = response.itineraries.filter((i) => {
			const t = new Date(q.arriveBy ? i.endTime : i.startTime);
			return publicTransitOnly(i) || (intvl_start <= t && t <= intvl_end);
		});
	} else {
		const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
		if (filterSettings === undefined) {
			error(500, { message: 'Internal error (taxi filter missing)' });
		}

		response.itineraries = filterTaxis(
			response.itineraries,
			filterSettings.perTransfer,
			filterSettings.taxiBase,
			filterSettings.taxiPerMinute,
			filterSettings.taxiDirectPenalty,
			filterSettings.ptSlope,
			filterSettings.taxiSlope
		).itineraries.filter((i) => {
			const t = new Date(q.arriveBy ? i.endTime : i.startTime);
			return intvl_start <= t && t <= intvl_end;
		});
	}

	const counters = {
		pt: [0, 0],
		taxi: [0, 0],
		rideshare: [0, 0]
	};
	const fuzz = (l: number) => Math.round(l * 10) / 10;
	plan_from?.labels({ lat: fuzz(response.from.lat), lon: fuzz(response.from.lon) }).inc();
	plan_to?.labels({ lat: fuzz(response.to.lat), lon: fuzz(response.to.lon) }).inc();

	const result = {
		...response!,
		itineraries: await Promise.all(
			response.itineraries.map(async (i: Itinerary) => {
				const odmLeg1 = i.legs.find(isOdmLeg);
				const odmLeg2 = i.legs.findLast(isOdmLeg);

				const odmLeg = odmLeg1 || odmLeg2;
				if (odmLeg) {
					const odm_only = i.legs.length > 1 ? 0 : 1;
					if (isRideShareLeg(odmLeg)) {
						counters.rideshare[odm_only]++;
					} else {
						counters.taxi[odm_only]++;
					}
					counters.pt[0]++;
				} else {
					counters.pt[1]++;
				}

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
									odmLeg1.tripId && isRideShareLeg(odmLeg1) ? odmLeg1.tripId : undefined
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
									odmLeg2.tripId && isRideShareLeg(odmLeg2) ? odmLeg2.tripId : undefined
								)
							: undefined,
					rideShareTourInfos
				};
			})
		)
	};
	for (const [key, value] of Object.entries(counters)) {
		for (let i = 0; i < 2; i++) {
			result_itineraries?.labels({ type: key, only: i }).observe(value[i]);
		}
	}
	if (timer) {
		timer();
	}
	return json(result);
};
