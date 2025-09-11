import { inXMinutes, prepareTest, white } from '../util';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/bookRide';
import { bookingApi } from '$lib/server/booking/bookingApi';
import { isSamePlace } from '$lib/server/booking/isSamePlace';

const inRothenburg1 = { lng: 14.962964035976825, lat: 51.34030696433544 };
const inRothenburg2 = { lng: 14.96375266477358, lat: 51.335866895211666 };
const inHorka1 = { lng: 14.89811075304624, lat: 51.30115190837412 };
const inHorka2 = { lng: 14.901778589533393, lat: 51.31925573322806 };
const inGeheege = { lng: 14.944479873593451, lat: 51.32191394274318 };
const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

describe('Concatenation tests', () => {
	it('create tour concetanation, simple prepend', async () => {
		const mockUserId = await prepareTest();
		const company = await addCompany(Zone.NIESKY, inRothenburg1);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inHorka1,
			target: inHorka2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(70)],
			startFixed: false,
			capacities
		});
		const whiteResponse = await white(body).then((r) => r.json());
		const connection1: ExpectedConnection = {
			start: { ...inHorka1, address: 'inHorka1' },
			target: { ...inHorka2, address: 'inHorka2' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(70)
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
			start: inRothenburg2,
			target: inGeheege,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(50)],
			startFixed: false,
			capacities
		});
		const whiteResponse2 = await white(body2).then((r) => r.json());
		const appendConnection: ExpectedConnection = {
			start: { ...inRothenburg2, address: 'inRothenburg2' },
			target: { ...inGeheege, address: 'inGeheege' },
			startTime: whiteResponse2.direct[0].pickupTime,
			targetTime: whiteResponse2.direct[0].dropoffTime,
			signature: '',
			startFixed: false,
			requestedTime: inXMinutes(50)
		};
		const bookingBodyAppend = {
			connection1: appendConnection,
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
		expect(isSamePlace(events[0], inRothenburg2)).toBeTruthy();
		expect(isSamePlace(events[1], inGeheege)).toBeTruthy();
		expect(isSamePlace(events[2], inHorka1)).toBeTruthy();
		expect(isSamePlace(events[3], inHorka2)).toBeTruthy();
	});
});
