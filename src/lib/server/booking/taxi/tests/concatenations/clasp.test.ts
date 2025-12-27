import { inXMinutes, prepareTest, white } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { isSamePlace } from '$lib/server/booking/isSamePlace';
import { Mode } from '$lib/server/booking/mode';

const inSchleife1 = { lng: 14.52871605284534, lat: 51.542426845522584 };
const inSagar = { lng: 14.758657981530547, lat: 51.51415366508925 };
const inPechern = { lng: 14.8618514371218, lat: 51.48208047929427 };
const inSchleife2 = {
	lng: 14.54208968262708,
	lat: 51.5452123938403
};
const inPriebus = { lng: 14.956745409017884, lat: 51.454554860185084 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

describe('Concatenation tests', () => {
	it('create tour concetanation, simple append', async () => {
		const mockUserId = await prepareTest();
		const company = await addCompany(Zone.WEIßWASSER, inSchleife1);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inSagar,
			target: inPechern,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse = await white(body).then((r) => r.json());
		console.log({ whiteResponse: whiteResponse.direct });
		const connection1: ExpectedConnection = {
			start: { ...inSagar, address: 'sagar' },
			target: { ...inPechern, address: 'pechern' },
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

		await bookingApi(bookingBody, mockUserId, false, true, 0, 0, 0, 0, true);
		const tours = await getTours();
		expect(tours.length).toBe(1);
		expect(tours[0].requests.length).toBe(1);
		const body2 = JSON.stringify({
			start: inSchleife2,
			target: inPriebus,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(90)],
			startFixed: false,
			capacities
		});
		const whiteResponse2 = await white(body2).then((r) => r.json());
		const claspConnection: ExpectedConnection = {
			start: { ...inSchleife2, address: 'schleife' },
			target: { ...inPriebus, address: 'priebus' },
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
		await bookingApi(bookingBodyAppend, mockUserId, false, true, 0, 0, 0, 0, true);
		const tours2 = await getTours();
		expect(tours2.length).toBe(1);
		expect(tours2[0].requests.length).toBe(2);
		const events = tours2
			.flatMap((t) => t.requests.flatMap((r) => r.events))
			.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
		expect(isSamePlace(events[0], inSchleife2)).toBe(true);
		expect(isSamePlace(events[1], inSagar)).toBe(true);
		expect(isSamePlace(events[2], inPechern)).toBe(true);
		expect(isSamePlace(events[3], inPriebus)).toBe(true);
	}, 15000);
});
