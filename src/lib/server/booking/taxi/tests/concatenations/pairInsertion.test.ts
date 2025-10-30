import { inXMinutes, prepareTest, white } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { isSamePlace } from '$lib/server/booking/isSamePlace';
import { Mode } from '$lib/server/booking/mode';

const inWW1 = { lng: 14.643847884365528, lat: 51.507181621441845 };
const inKringelsdorf = { lng: 14.606555746634228, lat: 51.38851958039794 };
const inBoxberg = { lng: 14.577917469763548, lat: 51.40877145079591 };
const inNochten = {
	lng: 14.600164657165266,
	lat: 51.43191720040872
};
const inWW2 = { lng: 14.63490818370542, lat: 51.499039246023926 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

describe('Concatenation tests', () => {
	it('create tour concetanation, insert pickup - append dropoff', async () => {
		const mockUserId = await prepareTest();
		const company = await addCompany(Zone.WEIßWASSER, inWW1);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inWW2,
			target: inBoxberg,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse = await white(body).then((r) => r.json());
		const connection1: ExpectedConnection = {
			start: { ...inWW2, address: 'weisswasser' },
			target: { ...inBoxberg, address: 'boxberg' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(70),
			mode: Mode.TAXI
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		await bookingApi(bookingBody, mockUserId, false, true, 0, 0, 0, true);
		const tours = await getTours();
		expect(tours.length).toBe(1);
		expect(tours[0].requests.length).toBe(1);
		const body2 = JSON.stringify({
			start: inNochten,
			target: inKringelsdorf,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(90)],
			startFixed: false,
			capacities
		});
		const whiteResponse2 = await white(body2).then((r) => r.json());
		const claspConnection: ExpectedConnection = {
			start: { ...inNochten, address: 'nochten' },
			target: { ...inKringelsdorf, address: 'kringelsdorf' },
			startTime: whiteResponse2.direct[0].pickupTime,
			targetTime: whiteResponse2.direct[0].dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(90),
			mode: Mode.TAXI
		};
		const bookingBodyAppend = {
			connection1: claspConnection,
			connection2: null,
			capacities
		};
		await bookingApi(bookingBodyAppend, mockUserId, false, true, 0, 0, 0, true);
		const tours2 = await getTours();
		expect(tours2.length).toBe(1);
		expect(tours2[0].requests.length).toBe(2);
		const events = tours2
			.flatMap((t) => t.requests.flatMap((r) => r.events))
			.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		expect(isSamePlace(events[0], inWW2)).toBe(true);
		expect(isSamePlace(events[1], inNochten)).toBe(true);
		expect(isSamePlace(events[2], inBoxberg)).toBe(true);
		expect(isSamePlace(events[3], inKringelsdorf)).toBe(true);
	}, 15000);
});
