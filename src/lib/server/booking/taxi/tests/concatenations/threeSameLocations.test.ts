import { inXMinutes, prepareTest, white } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { Mode } from '$lib/server/booking/mode';

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const inNiesky3 = { lat: 51.294046423258095, lng: 14.820774891510126 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

describe('Concatenation tests', () => {
	it('create tour concetanation, multiple pickups/dropoffs at same location', async () => {
		const mockUserId = await prepareTest();
		const company = await addCompany(Zone.NIESKY, inNiesky3);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse = await white(body).then((r) => r.json());
		const connection1: ExpectedConnection = {
			start: { ...inNiesky1, address: 'inNiesky1' },
			target: { ...inNiesky2, address: 'inNiesky2' },
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
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse2 = await white(body2).then((r) => r.json());
		expect(whiteResponse2.direct[0].pickupCase.how).not.toBe(InsertHow.NEW_TOUR);
		const appendConnection: ExpectedConnection = {
			start: { ...inNiesky1, address: 'inNiesky1' },
			target: { ...inNiesky2, address: 'inNiesky2' },
			startTime: whiteResponse2.direct[0].pickupTime,
			targetTime: whiteResponse2.direct[0].dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(70),
			mode: Mode.TAXI
		};
		const bookingBodyAppend = {
			connection1: appendConnection,
			connection2: null,
			capacities
		};
		await bookingApi(bookingBodyAppend, mockUserId, false, true, 0, 0, 0, 0, true);
		const tours2 = await getTours();
		expect(tours2.length).toBe(1);
		expect(tours2[0].requests.length).toBe(2);

		const body3 = JSON.stringify({
			start: inNiesky1,
			target: inNiesky2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse3 = await white(body3).then((r) => r.json());
		const appendConnection2: ExpectedConnection = {
			start: { ...inNiesky1, address: 'inNiesky1' },
			target: { ...inNiesky2, address: 'inNiesky2' },
			startTime: whiteResponse3.direct[0]!.pickupTime,
			targetTime: whiteResponse3.direct[0]!.dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(70),
			mode: Mode.TAXI
		};
		const bookingBodyAppend2 = {
			connection1: appendConnection2,
			connection2: null,
			capacities
		};
		await bookingApi(bookingBodyAppend2, mockUserId, false, true, 0, 0, 0, 0, true);
		const tours3 = await getTours();
		expect(tours3.length).toBe(1);
		expect(tours3[0].requests.length).toBe(3);
	});
});
