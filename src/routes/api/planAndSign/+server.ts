import { env } from '$env/dynamic/public';
import { plan, type Itinerary, type PlanData } from '$lib/openapi';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { fail, json, type RequestEvent } from '@sveltejs/kit';
import { getRideShareInfos } from '$lib/server/booking/rideShare/getRideShareInfo';
import { isOdmLeg, isTaxiLeg } from '$lib/util/booking/checkLegType';
import type { BusStop } from '$lib/server/booking/taxi/BusStop';
import { whitelist } from '../whitelist/whitelist';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Insertion } from '$lib/server/booking/taxi/insertion';

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

	const from: Coordinates = { lat: response.from.lat, lng: response.from.lon };
	const to: Coordinates = { lat: response.to.lat, lng: response.to.lon };
	const c: Capacities = {
		wheelchairs: q.pedestrianProfile == 'WHEELCHAIR' ? 1 : 0,
		bikes: q.requireBikeTransport ? 1 : 0,
		passengers: q.passengers ?? 1,
		luggage: q.luggage ?? 0
	};
	const [firstMileIn, lastMileIn] = extractTaxiEvents(response.itineraries);
	const [firstMileOut, lastMileOut] = await Promise.all([
		whitelist(from, firstMileIn, c, false),
		whitelist(to, lastMileIn, c, true)
	]);

	adjustTaxiEvents(response.itineraries, firstMileIn, lastMileIn, firstMileOut, lastMileOut);

	// add direct

	// mixer

	return json({
		...response!,
		itineraries: await Promise.all(
			response!.itineraries.map(async (i: Itinerary) => {
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

function extractTaxiEvents(itineraries: Array<Itinerary>) {
	let firstMileStops = new Array<BusStop>();
	let lastMileStops = new Array<BusStop>();
	itineraries.forEach((i) => {
		const firstMileTaxi = i.legs.length > 1 && isTaxiLeg(i.legs[0]) ? i.legs[0] : undefined;
		const lastMileTaxi =
			i.legs.length > 1 && isTaxiLeg(i.legs[i.legs.length - 1])
				? i.legs[i.legs.length - 1]
				: undefined;
		if (firstMileTaxi !== undefined) {
			let bs = firstMileStops.find(
				(x) => x.lat == firstMileTaxi.to.lat && x.lng == firstMileTaxi.to.lon
			);
			if (bs == undefined) {
				bs =
					firstMileStops[
						firstMileStops.push({
							lat: firstMileTaxi.to.lat,
							lng: firstMileTaxi.to.lon,
							times: new Array<number>()
						}) - 1
					];
			}
			bs.times.push(new Date(firstMileTaxi.endTime).getTime());
		}
		if (lastMileTaxi !== undefined) {
			let bs = lastMileStops.find(
				(x) => x.lat == lastMileTaxi.from.lat && x.lng == lastMileTaxi.from.lon
			);
			if (bs == undefined) {
				bs =
					lastMileStops[
						lastMileStops.push({
							lat: lastMileTaxi.from.lat,
							lng: lastMileTaxi.from.lon,
							times: new Array<number>()
						}) - 1
					];
			}
			bs.times.push(new Date(lastMileTaxi.startTime).getTime());
		}
	});
	return [firstMileStops, lastMileStops];
}

function adjustTaxiEvents(
	itineraries: Array<Itinerary>,
	firstMileIn: Array<BusStop>,
	lastMileIn: Array<BusStop>,
	firstMileOut: Array<(Insertion | undefined)[]>,
	lastMileOut: Array<(Insertion | undefined)[]>
) {
	let toRemove = new Array<number>();
	for (const [index, i] of itineraries.entries()) {
		const firstMileTaxi = i.legs.length > 1 && isTaxiLeg(i.legs[0]) ? i.legs[0] : undefined;
		const lastMileTaxi =
			i.legs.length > 1 && isTaxiLeg(i.legs[i.legs.length - 1])
				? i.legs[i.legs.length - 1]
				: undefined;
		if (firstMileTaxi !== undefined) {
			const bsIndex = firstMileIn.findIndex(
				(x) => x.lat == firstMileTaxi.to.lat && x.lng == firstMileTaxi.to.lon
			);

			if (firstMileOut[bsIndex] == undefined) {
				toRemove.push(index);
				continue;
			}

			const timeIndex = firstMileIn[bsIndex].times.findIndex(
				(x) => x == new Date(firstMileTaxi.endTime).getTime()
			);
			const insertion = firstMileOut[bsIndex][timeIndex];

			if (insertion == undefined) {
				toRemove.push(index);
				continue;
			}

			i.startTime = firstMileTaxi.startTime = firstMileTaxi.scheduledStartTime = new Date(insertion.pickupTime).toISOString();
			firstMileTaxi.endTime = firstMileTaxi.scheduledEndTime = new Date(insertion.dropoffTime).toISOString();
			firstMileTaxi.duration = (insertion.dropoffTime - insertion.pickupTime) / 1000;
			i.duration = (new Date(i.endTime).getTime() - insertion.pickupTime) / 1000;
		}
		if (lastMileTaxi !== undefined) {
			const bsIndex = lastMileIn.findIndex(
				(x) => x.lat == lastMileTaxi.to.lat && x.lng == lastMileTaxi.to.lon
			);

			if (lastMileOut[bsIndex] == undefined) {
				toRemove.push(index);
				continue;
			}

			const timeIndex = lastMileIn[bsIndex].times.findIndex(
				(x) => x == new Date(lastMileTaxi.startTime).getTime()
			);
			const insertion = lastMileOut[bsIndex][timeIndex];

			if (insertion == undefined) {
				toRemove.push(index);
				continue;
			}

			lastMileTaxi.startTime = lastMileTaxi.scheduledStartTime = new Date(insertion.pickupTime).toISOString();
			i.endTime = lastMileTaxi.endTime = lastMileTaxi.scheduledEndTime = new Date(insertion.dropoffTime).toISOString();
			lastMileTaxi.duration = (insertion.dropoffTime - insertion.pickupTime) / 1000;
			i.duration = (insertion.dropoffTime - new Date(i.startTime).getTime()) / 1000;
		}
	}
	toRemove.forEach((i) => {
		itineraries.splice(i, 1);
	});
}
