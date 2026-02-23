import { white } from '$lib/server/booking/testUtils';
import { type Coordinates } from '$lib/util/Coordinates';
import { generateBookingParameters } from '../generateBookingParameters';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';
import { bookingApiCall } from './bookingFull';

export async function booking(
	customerId: number,
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
	compareCosts?: boolean,
	doWhitelist?: boolean
): Promise<ActionResponse> {
	const parameters = await generateBookingParameters(coordinates, restricted);
	const potentialKids = parameters.capacities.passengers - 1;
	const kidsZeroToTwo = randomInt(0, potentialKids);
	const kidsThreeToFour = randomInt(0, potentialKids - kidsZeroToTwo);
	const kidsFiveToSix = randomInt(0, potentialKids - kidsThreeToFour);
	const requestedTime = parameters.connection1!.startFixed
		? parameters.connection1!.startTime
		: parameters.connection1!.targetTime;
	const body = JSON.stringify({
		start: parameters.connection1!.start,
		target: parameters.connection1!.target,
		startBusStops: [],
		targetBusStops: [],
		directTimes: [requestedTime],
		startFixed: parameters.connection1!.startFixed,
		capacities: parameters.capacities
	});
	const whiteResponse = await white(body).then((r) => r.json());
	if (doWhitelist) {
		if (whiteResponse.direct[0] === null) {
			console.log('whitelist was not succesful.');
			return {
				lastActionSpecifics: null,
				success: false,
				error: false,
				atomicDurations: {} as Record<string, number>
			};
		}
		parameters.connection1!.startTime = whiteResponse.direct[0]!.pickupTime;
		parameters.connection1!.targetTime = whiteResponse.direct[0]!.dropoffTime;
		parameters.connection1!.requestedTime = requestedTime;
	}
	return await bookingApiCall(
		customerId,
		parameters,
		kidsZeroToTwo,
		kidsThreeToFour,
		kidsFiveToSix,
		doWhitelist,
		compareCosts
	);
}
