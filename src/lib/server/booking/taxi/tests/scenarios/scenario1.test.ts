import { inXMinutes, prepareTest, white } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { isSamePlace } from '$lib/server/booking/isSamePlace';
import { Mode } from '$lib/server/booking/mode';
import type { Coordinates } from '$lib/util/Coordinates';
import type { Capacities } from '$lib/util/booking/Capacities';

async function whiteAndBook(
	start: Coordinates,
	target: Coordinates,
	user: number,
	time: number,
	startFixed: boolean,
	capacities: Capacities,
	startAddress?: string,
	targetAddress?: string
) {
	const body = JSON.stringify({
		start,
		target,
		startBusStops: [],
		targetBusStops: [],
		directTimes: [time],
		startFixed,
		capacities
	});
	const whiteResponse = await white(body).then((r) => r.json());
	const connection1: ExpectedConnection = {
		start: { ...start, address: startAddress ?? 'a' },
		target: { ...target, address: targetAddress ?? 'b' },
		startTime: whiteResponse.direct[0].pickupTime,
		targetTime: whiteResponse.direct[0].dropoffTime,
		signature: '',
		startFixed,
		requestedTime: time,
		mode: Mode.TAXI
	};
	const bookingBody = {
		connection1,
		connection2: null,
		capacities
	};
	await bookingApi(bookingBody, user, false, true, 0, 0, 0, false);
}

// 1
const inWW = { lng: 14.63490818370542, lat: 51.499039246023926 };
const inBoxberg = { lng: 14.577917469763548, lat: 51.40877145079591 };

// 2
const wwBhf = { lng: 14.637890411515059, lat: 51.50577743128434 };
const boxbergDiesterweg = { lng: 14.57974388256821, lat: 51.40416900732731 };

// 3
const wwBautzener = { lng: 14.632576396815239, lat: 51.49688776336018 };
const boxbergAlteBautzener = { lng: 14.577521488787994, lat: 51.40861954813761 };

// 4
const inKringelsdorf = { lng: 14.606555746634228, lat: 51.38851958039794 };
const inNochten = {
	lng: 14.600164657165266,
	lat: 51.43191720040872
};

const companyCentral = { lng: 14.643847884365528, lat: 51.507181621441845 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

describe('Concatenation tests', () => {
	it('concatenate 1 and 4', async () => {
		await testScenario(inWW, inBoxberg, inNochten, inKringelsdorf, [
			inWW,
			inNochten,
			inBoxberg,
			inKringelsdorf
		]);
	}, 15000);

	it('concatenate 1 and 3', async () => {
		await testScenario(inWW, inBoxberg, wwBautzener, boxbergAlteBautzener, [
			inWW,
			wwBautzener,
			inBoxberg,
			boxbergAlteBautzener
		]);
	}, 15000);

	it('concatenate 1 and 2', async () => {
		await testScenario(inWW, inBoxberg, wwBhf, boxbergDiesterweg, [
			wwBhf,
			inWW,
			inBoxberg,
			boxbergDiesterweg
		]);
	}, 15000);

	it('concatenate 2 and 4', async () => {
		await testScenario(wwBhf, boxbergDiesterweg, inNochten, inKringelsdorf, [
			wwBhf,
			inNochten,
			boxbergDiesterweg,
			inKringelsdorf
		]);
	}, 15000);

	it('concatenate 2 and 3', async () => {
		// wwBhf, wwBautzener, boxbergAlteBautzener, boxbergDiesterweg - would be preferable order, but might not be possible due to time constraints
		await testScenario(wwBhf, boxbergDiesterweg, wwBautzener, boxbergAlteBautzener, [
			wwBhf,
			wwBautzener,
			undefined,
			undefined
		]);
	}, 15000);

	it('concatenate 3 and 4', async () => {
		await testScenario(wwBautzener, boxbergAlteBautzener, inNochten, inKringelsdorf, [
			wwBautzener,
			inNochten,
			boxbergAlteBautzener,
			inKringelsdorf
		]);
	}, 15000);
});

async function checkEventOrder(expectedCoordinates: (Coordinates | undefined)[]) {
	const tours = await getTours();
	expect(tours.length).toBe(1);
	expect(tours[0].requests.length).toBe(2);
	const events = tours
		.flatMap((t) => t.requests.flatMap((r) => r.events))
		.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
	expect(expectedCoordinates).toHaveLength(events.length);
	for (let i = 0; i != expectedCoordinates.length; ++i) {
		if (expectedCoordinates[i] !== undefined) {
			expect(isSamePlace(events[i], expectedCoordinates[i]!)).toBe(true);
		}
	}
}

async function testScenario(
	start1: Coordinates,
	target1: Coordinates,
	start2: Coordinates,
	target2: Coordinates,
	expectedCoordinates: (Coordinates | undefined)[]
) {
	const mockUserId = await prepareTest();
	const company = await addCompany(Zone.WEIßWASSER, companyCentral);
	const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
	await setAvailability(taxi, inXMinutes(0), inXMinutes(600));

	await whiteAndBook(start1, target1, mockUserId, inXMinutes(70), false, capacities);
	const tours = await getTours();
	expect(tours.length).toBe(1);
	expect(tours[0].requests.length).toBe(1);
	await whiteAndBook(start2, target2, mockUserId, inXMinutes(90), false, capacities);
	await checkEventOrder(expectedCoordinates);
}
