import { addRideShareTour } from '$lib/server/booking';
import { type ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { getRideShareTourByRequest } from '$lib/server/booking/rideShare/getRideShareTours';
import { type BookingParameters } from '$lib/server/booking/rideShare/rideShareApi';
import { type Coordinates } from '$lib/util/Coordinates';
import { generateBookingParameters } from '../generateBookingParameters';
import type { ActionResponse } from '../simulation';

export async function addRideShareTourLocal(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined
): Promise<ActionResponse> {
	const parameters: BookingParameters = await generateBookingParameters(coordinates, restricted);
	const connection: ExpectedConnection = parameters.connection1!;
	const capacities = parameters.capacities;
	const request = await addRideShareTour(
		connection.startFixed ? connection.startTime : connection.targetTime,
		connection.startFixed,
		capacities.passengers,
		capacities.luggage,
		1,
		1,
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
