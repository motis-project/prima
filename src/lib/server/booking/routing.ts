import type { Coordinates } from '$lib/util/Coordinates';
import type { BusStop } from './BusStop';
import type { Company } from './getBookingAvailability';
import { isSamePlace } from './isSamePlace';
import { batchOneToManyCarRouting } from '$lib/server/util/batchOneToManyCarRouting';
import type { VehicleId } from './VehicleId';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { iterateAllInsertions } from './iterateAllInsertions';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';

export type InsertionRoutingResult = {
	company: (number | undefined)[];
	event: (number | undefined)[];
};

export type RoutingResults = {
	busStops: { fromBusStop: InsertionRoutingResult[]; toBusStop: InsertionRoutingResult[] };
	userChosen: { fromUserChosen: InsertionRoutingResult; toUserChosen: InsertionRoutingResult };
};

export async function routing(
	companies: Company[],
	userChosen: Coordinates,
	busStops: BusStop[],
	insertionRanges: Map<VehicleId, Range[]>
): Promise<RoutingResults> {
	const setZeroDistanceForMatchingPlaces = (
		coordinatesOne: Coordinates,
		coordinatesMany: (Coordinates | undefined)[],
		routingResult: (number | undefined)[],
		comesFromCompany: boolean
	) => {
		const result = new Array<number | undefined>(routingResult.length);
		for (let i = 0; i != coordinatesMany.length; ++i) {
			if (coordinatesMany[i] === undefined) {
				continue;
			}
			if (isSamePlace(coordinatesOne, coordinatesMany[i]!)) {
				result[i] = 0;
			} else if (!comesFromCompany && routingResult[i] !== undefined) {
				result[i] = routingResult[i]! + PASSENGER_CHANGE_DURATION;
			} else {
				result[i] = routingResult[i];
			}
		}
		return result;
	};

	const forward: ((Coordinates & { id: number }) | undefined)[] = companies.map((c) => {
		return { lat: c.lat, lng: c.lng, id: c.id };
	});

	const backward: ((Coordinates & { id: number }) | undefined)[] = companies.map((c) => {
		return { lat: c.lat, lng: c.lng, id: c.id };
	});
	iterateAllInsertions(companies, insertionRanges, (info) => {
		forward.push(
			info.idxInVehicleEvents === info.vehicle.events.length
				? undefined
				: info.vehicle.events[info.idxInVehicleEvents]
		);
		backward.push(
			info.idxInVehicleEvents === 0 ? undefined : info.vehicle.events[info.idxInVehicleEvents - 1]
		);
	});
	let fromUserChosen = await batchOneToManyCarRouting(userChosen, forward, false);
	const toUserChosen = await batchOneToManyCarRouting(userChosen, backward, true);
	fromUserChosen = setZeroDistanceForMatchingPlaces(userChosen, forward, fromUserChosen, false);
	let companyToUserChosen = toUserChosen.slice(0, companies.length);
	let eventToUserChosen = toUserChosen.slice(companies.length);
	companyToUserChosen = setZeroDistanceForMatchingPlaces(
		userChosen,
		backward.slice(0, companies.length),
		companyToUserChosen,
		true
	);
	eventToUserChosen = setZeroDistanceForMatchingPlaces(
		userChosen,
		backward.slice(companies.length),
		eventToUserChosen,
		false
	);

	const fromBusStop = await Promise.all(
		busStops.map((b) => batchOneToManyCarRouting(b, forward, false))
	);
	const toBusStop = await Promise.all(
		busStops.map((b) => batchOneToManyCarRouting(b, backward, true))
	);
	return {
		userChosen: {
			fromUserChosen: {
				company: fromUserChosen.slice(0, companies.length),
				event: fromUserChosen.slice(companies.length)
			},
			toUserChosen: {
				company: companyToUserChosen,
				event: eventToUserChosen
			}
		},
		busStops: {
			fromBusStop: fromBusStop.map((b, busStopIdx) => {
				const updatedB = setZeroDistanceForMatchingPlaces(busStops[busStopIdx], forward, b, false);
				return {
					company: updatedB.slice(0, companies.length),
					event: updatedB.slice(companies.length)
				};
			}),
			toBusStop: toBusStop.map((b, busStopIdx) => {
				const values = {
					company: b.slice(0, companies.length),
					event: b.slice(companies.length)
				};
				values.company = setZeroDistanceForMatchingPlaces(
					busStops[busStopIdx],
					backward.slice(0, companies.length),
					values.company,
					true
				);
				values.event = setZeroDistanceForMatchingPlaces(
					busStops[busStopIdx],
					backward.slice(companies.length),
					values.event,
					false
				);
				return values;
			})
		}
	};
}
