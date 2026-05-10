import { addRideShareTour } from '$lib/server/booking';
import { type ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { getRideShareTourByRequest } from '$lib/server/booking/rideShare/getRideShareTours';
import { type BookingParameters } from '$lib/server/booking/rideShare/rideShareApi';
import { type Coordinates } from '$lib/util/Coordinates';
import { generateBookingParameters } from '../generateBookingParameters';
import { randomInt } from '../randomInt';
import type { ActionResponse, RideShareProvider } from '../simulation';

export async function addRideShareTourSimulation(
	customerId: number,
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined,
	_mode?: string,
	_compareCosts?: boolean,
	_doWhitelist?: boolean,
	rideShareProviders: RideShareProvider[] = []
): Promise<ActionResponse> {
	if (rideShareProviders.length === 0) {
		console.log('Cannot add ride-share tour because no ride-share providers were created.');
		return {
			lastActionSpecifics: null,
			success: false,
			error: true,
			atomicDurations: {} as Record<string, number>
		};
	}
	const parameters: BookingParameters = await generateBookingParameters(coordinates, restricted);
	const connection: ExpectedConnection = parameters.connection1!;
	const capacities = parameters.capacities;
	const provider = rideShareProviders[randomInt(0, rideShareProviders.length - 1)];
	const request = await addRideShareTour(
		[connection.startFixed ? connection.startTime : connection.targetTime],
		connection.startFixed,
		capacities.passengers,
		capacities.luggage,
		provider.userId,
		provider.vehicleId,
		connection.start,
		connection.target,
		connection.start.address,
		connection.target.address
	);
	console.log(`Adding a ride share tour was ${request === undefined ? 'not' : ''} succesful.`);
	if (request === undefined) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const newTour = await getRideShareTourByRequest(request);
	return {
		lastActionSpecifics: {
			vehicleId: newTour[0].vehicle,
			dayStart: newTour[0].requests[0].events[0].communicatedTime
		},
		success: true,
		error: false,
		atomicDurations: {} as Record<string, number>
	};
}
