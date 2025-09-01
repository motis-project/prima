import { inXMinutes, prepareTest, white } from '../util';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import { describe, it, expect } from 'vitest';
import type { ExpectedConnection } from '$lib/server/booking/bookRide';
import { bookingApi } from '$lib/server/booking/bookingApi';
import { signEntry } from '../../signEntry';
import { MINUTE, roundToUnit } from '$lib/util/time';

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
	it('create tour concetanation, connect with detour', async () => {
		const mockUserId = await prepareTest();
		const company = await addCompany(Zone.NIESKY, inRothenburg1);
		const taxi = await addTaxi(company, { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 });
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));
		const body = JSON.stringify({
			start: inGeheege,
			target: inRothenburg2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(45)],
			startFixed: false,
			capacities
		});
		const whiteResponse = await white(body).then((r) => r.json());
		const connection1: ExpectedConnection = {
			start: { ...inGeheege, address: 'inGeheege' },
			target: { ...inRothenburg2, address: 'inRothenburg2' },
			startTime: whiteResponse.direct[0].pickupTime,
			targetTime: whiteResponse.direct[0].dropoffTime,
			signature: signEntry(
				inGeheege.lat,
				inGeheege.lng,
				inRothenburg2.lat,
				inRothenburg2.lng,
				whiteResponse.direct[0].pickupTime,
				roundToUnit(whiteResponse.direct[0].dropoffTime, MINUTE, Math.floor),
				false
			),
			startFixed: false,
			requestedTime: inXMinutes(45)
		};
		const bookingBody = {
			connection1,
			connection2: null,
			capacities
		};

		await bookingApi(bookingBody, mockUserId, true, 0, 0, 0, 0, false);
		const tours = await getTours();
		expect(tours.length).toBe(1);
		expect(tours[0].requests.length).toBe(1);

		const body2 = JSON.stringify({
			start: inHorka1,
			target: inRothenburg2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(65)],
			startFixed: true,
			capacities
		});
		const whiteResponse2 = await white(body2).then((r) => r.json());
		const connection2: ExpectedConnection = {
			start: { ...inHorka1, address: 'inHorka1' },
			target: { ...inRothenburg2, address: 'inRothenburg2' },
			startTime: whiteResponse2.direct[0].pickupTime,
			targetTime: whiteResponse2.direct[0].dropoffTime,
			signature: signEntry(
				inHorka1.lat,
				inHorka1.lng,
				inRothenburg2.lat,
				inRothenburg2.lng,
				whiteResponse.direct[0].pickupTime,
				roundToUnit(whiteResponse.direct[0].dropoffTime, MINUTE, Math.floor),
				true
			),
			startFixed: true,
			requestedTime: inXMinutes(65)
		};
		const bookingBody2 = {
			connection1: connection2,
			connection2: null,
			capacities
		};
		await bookingApi(bookingBody2, mockUserId, true, 0, 0, 0, 0, false);
		const tours2 = await getTours();
		expect(tours2.length).toBe(2);
		expect(tours2[0].requests.length).toBe(1);
		expect(tours2[1].requests.length).toBe(1);

		const body3 = JSON.stringify({
			start: inRothenburg2,
			target: inHorka2,
			startBusStops: [],
			targetBusStops: [],
			directTimes: [inXMinutes(60)],
			startFixed: false,
			capacities
		});
		const whiteResponse3 = await white(body3).then((r) => r.json());
		const connection3: ExpectedConnection = {
			start: { ...inRothenburg2, address: 'inRothenburg2' },
			target: { ...inHorka2, address: 'inHorka2' },
			startTime: whiteResponse3.direct[0].pickupTime,
			targetTime: whiteResponse3.direct[0].dropoffTime,
			signature: signEntry(
				inRothenburg2.lat,
				inRothenburg2.lng,
				inHorka2.lat,
				inHorka2.lng,
				whiteResponse.direct[0].pickupTime,
				roundToUnit(whiteResponse.direct[0].dropoffTime, MINUTE, Math.floor),
				false
			),
			startFixed: false,
			requestedTime: inXMinutes(60)
		};
		const bookingBodyConnect = {
			connection1: connection3,
			connection2: null,
			capacities
		};
		await bookingApi(bookingBodyConnect, mockUserId, true, 0, 0, 0, 0, false);
		const tours3 = await getTours();
		expect(tours3.length).toBe(1);
		expect(tours3[0].requests.length).toBe(3);
	}, 20000);
});
