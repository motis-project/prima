import { env } from '$env/dynamic/public';
import { plan, type Itinerary, type PlanData } from '$lib/openapi';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { json, type RequestEvent } from '@sveltejs/kit';
import { isOdmLeg, isRideShareLeg } from '../../(customer)/routing/utils';
import {
	getRideShareInfo,
	type RideShareTourInfo
} from '$lib/server/booking/rideShare/getRideShareInfo';

export const POST = async (event: RequestEvent) => {
	const q: PlanData['query'] = await event.request.json();
	const r = await plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: q
	});
	const response = r.data;
	console.log(r.request);
	if (response === undefined) {
		return json({});
	}
	return json({
		...response!,
		itineraries: await Promise.all(
			response!.itineraries.map(async (i: Itinerary) => {
				const odmLeg1 = i.legs.find(isOdmLeg);
				const odmLeg2 = i.legs.findLast(isOdmLeg);
				const rideShareTourInfos: RideShareTourInfo[] = [];
				if (i.legs.length !== 0) {
					const rideShareTourFirstLeg = isRideShareLeg(i.legs[0])
						? parseInt(i.legs[0].tripId!)
						: undefined;
					const rideShareTourLastLeg =
						i.legs.length > 1 && isRideShareLeg(i.legs[i.legs.length - 1])
							? parseInt(i.legs[i.legs.length - 1].tripId!)
							: undefined;
					if (rideShareTourFirstLeg !== undefined && !isNaN(rideShareTourFirstLeg)) {
						rideShareTourInfos.push(await getRideShareInfo(rideShareTourFirstLeg));
					}
					if (rideShareTourLastLeg !== undefined && !isNaN(rideShareTourLastLeg)) {
						rideShareTourInfos.push(await getRideShareInfo(rideShareTourLastLeg));
					}
				}
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
									false
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
									true
								)
							: undefined,
					rideShareTourInfos
				};
			})
		)
	});
};
