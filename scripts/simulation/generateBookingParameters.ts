import { type BookingParameters } from '../../src/lib/server/booking/taxi/bookingApi';
import type { ExpectedConnection } from '../../src/lib/server/booking/expectedConnection';
import type { Capacities } from '../../src/lib/util/booking/Capacities';
import { type Coordinates } from '../../src/lib/util/Coordinates';
import { HOUR, MINUTE, DAY } from '../../src/lib/util/time';
import { randomInt } from './randomInt';
import { reverseGeo } from '../../src/lib/server/util/reverseGeocode';
import { Mode } from '../../src/lib/server/booking/mode';

export async function generateBookingParameters(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined
): Promise<BookingParameters> {
	return {
		connection1: await generateExpectedConnection(coordinates, restricted),
		connection2: null,
		capacities: generateCapacities()
	};
}

async function generateExpectedConnection(
	coordinates: Coordinates[],
	restricted: Coordinates[] | undefined
): Promise<ExpectedConnection> {
	const chosenCoordinates = restricted ? restricted : coordinates;
	const r1 = randomInt(0, chosenCoordinates.length);
	const c1 = chosenCoordinates[r1];
	let r2 = r1;
	while (r2 === r1) {
		r2 = randomInt(0, coordinates.length);
	}
	const c2 = coordinates[r2];
	const a1 = await reverseGeo(c1);
	const a2 = await reverseGeo(c2);

	const rt1 = randomInt(Date.now(), Date.now() + DAY * 14 - 2 * HOUR);
	const rt2 = randomInt(rt1 + 15 * MINUTE, rt1 + HOUR);

	const r1IsStart = Math.random() < 0.5;
	const loc1 = { ...c1, address: a1 };
	const loc2 = { ...c2, address: a2 };

	return {
		start: r1IsStart ? loc1 : loc2,
		target: r1IsStart ? loc2 : loc1,
		startTime: rt1,
		targetTime: rt2,
		signature: '',
		startFixed: Math.random() < 0.5,
		mode: Mode.TAXI,
		requestedTime: undefined
	};
}

function generateCapacities(): Capacities {
	return {
		passengers: randomInt(1, 3),
		bikes: randomInt(0, 1),
		luggage: randomInt(0, 1),
		wheelchairs: randomInt(0, 1)
	};
}
