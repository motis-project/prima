import { db } from '$lib/server/db';
import { moveTour } from '$lib/server/moveTour';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { HOUR, MINUTE } from '$lib/util/time';
import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	getTours,
	setEvent,
	setRequest,
	setTour
} from '$lib/testHelpers';
import { beforeEach, describe, expect, it } from 'vitest';
import { cancelTour } from '$lib/server/cancelTour';
import { cancelRequest } from '$lib/server/db/cancelRequest';

const capacities = { passengers: 4, bikes: 0, wheelchairs: 0, luggage: 4 };
const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const inNiesky3 = { lat: 51.294046423258095, lng: 14.820774891510126 };

async function addTour(
	vehicleId: number,
	customerId: number,
	departure: number,
	arrival: number,
	start: { lat: number; lng: number },
	end: { lat: number; lng: number },
	directDuration: number | null = null
) {
	const tour = await setTour(vehicleId, departure, arrival);
	const requestId = (await setRequest(tour!.id, customerId, '')).id;
	await setEvent(requestId, departure + 1_000, true, start.lat, start.lng);
	await setEvent(requestId, arrival - 1_000, false, end.lat, end.lng);
	await db.updateTable('tour').set({ directDuration }).where('id', '=', tour!.id).execute();
	return tour!;
}

async function getDirectDuration(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number }
) {
	const [duration] = await oneToManyCarRouting(from, [to], false);
	expect(duration).toBeDefined();
	return duration === undefined ? null : duration + PASSENGER_CHANGE_DURATION;
}

beforeEach(async () => {
	await clearDatabase();
});

describe('moveTour direct durations', () => {
	it('does not select the moved tour as its own predecessor on the new vehicle', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const newVehicleId = await addTaxi(companyId, capacities);
		const departure = Date.now() + MINUTE;
		const movedTour = await addTour(
			oldVehicleId,
			customerId,
			departure,
			departure + 30_000,
			inNiesky1,
			inNiesky2
		);

		expect(await moveTour(movedTour.id, newVehicleId, companyId)).toEqual({ status: 200 });

		const tours = await getTours();
		const storedMovedTour = tours.find((tour) => tour.id === movedTour.id);
		expect(storedMovedTour?.vehicle).toBe(newVehicleId);
		expect(storedMovedTour?.directDuration).toBeNull();
	});

	it('updates every affected direct duration when moving a tour between other tours', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const newVehicleId = await addTaxi(companyId, capacities);
		const emptyVehicleId = await addTaxi(companyId, capacities);
		const start = Date.now() + HOUR;
		const initialMovedDuration = await getDirectDuration(inNiesky1, inNiesky3);
		const initialOldNextDuration = await getDirectDuration(inNiesky3, inNiesky2);
		const initialNewNextDuration = await getDirectDuration(inNiesky2, inNiesky1);
		const oldVehicleDuration = await getDirectDuration(inNiesky1, inNiesky2);
		const movedTourDuration = await getDirectDuration(inNiesky2, inNiesky3);
		const newVehicleDuration = await getDirectDuration(inNiesky3, inNiesky1);

		const oldPrevious = await addTour(
			oldVehicleId,
			customerId,
			start,
			start + 2 * MINUTE,
			inNiesky3,
			inNiesky1
		);
		const movedTour = await addTour(
			oldVehicleId,
			customerId,
			start + 4 * MINUTE,
			start + 6 * MINUTE,
			inNiesky3,
			inNiesky3,
			initialMovedDuration
		);
		const oldNext = await addTour(
			oldVehicleId,
			customerId,
			start + 8 * MINUTE,
			start + 10 * MINUTE,
			inNiesky2,
			inNiesky3,
			initialOldNextDuration
		);
		const newPrevious = await addTour(
			newVehicleId,
			customerId,
			start,
			start + 2 * MINUTE,
			inNiesky1,
			inNiesky2
		);
		const newNext = await addTour(
			newVehicleId,
			customerId,
			start + 8 * MINUTE,
			start + 10 * MINUTE,
			inNiesky1,
			inNiesky3,
			initialNewNextDuration
		);

		expect(await moveTour(movedTour.id, newVehicleId, companyId)).toEqual({ status: 200 });

		const tours = await getTours();
		const directDuration = (tourId: number) =>
			tours.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration(oldPrevious.id)).toBeNull();
		expect(directDuration(oldNext.id)).toBe(oldVehicleDuration);
		expect(directDuration(newPrevious.id)).toBeNull();
		expect(directDuration(movedTour.id)).toBe(movedTourDuration);
		expect(directDuration(newNext.id)).toBe(newVehicleDuration);
		expect(tours.find((tour) => tour.id === movedTour.id)?.vehicle).toBe(newVehicleId);

		expect(await moveTour(movedTour.id, emptyVehicleId, companyId)).toEqual({ status: 200 });
		const tours2 = await getTours();
		const directDuration2 = (tourId: number) =>
			tours2.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration2(movedTour.id)).toBeNull();
		expect(directDuration2(newNext.id)).toBe(initialNewNextDuration);
		expect(tours2.find((tour) => tour.id === movedTour.id)?.vehicle).toBe(emptyVehicleId);
	});
	it('sets directDuration to null for tours which lose their predecessor due to tour move', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const newVehicleId = await addTaxi(companyId, capacities);
		const start = Date.now() + HOUR;
		const initialNextDuration = await getDirectDuration(inNiesky3, inNiesky2);

		const movedTour = await addTour(
			oldVehicleId,
			customerId,
			start + 4 * MINUTE,
			start + 6 * MINUTE,
			inNiesky3,
			inNiesky3
		);
		const next = await addTour(
			oldVehicleId,
			customerId,
			start + 8 * MINUTE,
			start + 10 * MINUTE,
			inNiesky2,
			inNiesky3,
			initialNextDuration
		);

		const tours = await getTours();
		const directDuration = (tourId: number) =>
			tours.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration(next.id)).toBe(initialNextDuration);
		expect(directDuration(movedTour.id)).toBeNull();

		expect(await moveTour(movedTour.id, newVehicleId, companyId)).toEqual({ status: 200 });

		const tours2 = await getTours();
		const directDuration2 = (tourId: number) =>
			tours2.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration2(movedTour.id)).toBeNull();
		expect(directDuration2(next.id)).toBeNull();
		expect(tours2.find((tour) => tour.id === movedTour.id)?.vehicle).toBe(newVehicleId);
	});
	it('sets directDuration to null for tours which lose their predecessor due to tour cancelation', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const start = Date.now() + HOUR;
		const initialNextDuration = await getDirectDuration(inNiesky3, inNiesky2);

		const cancelledTour = await addTour(
			oldVehicleId,
			customerId,
			start + 4 * MINUTE,
			start + 6 * MINUTE,
			inNiesky3,
			inNiesky3
		);
		const next = await addTour(
			oldVehicleId,
			customerId,
			start + 8 * MINUTE,
			start + 10 * MINUTE,
			inNiesky2,
			inNiesky3,
			initialNextDuration
		);

		const tours = await getTours();
		const directDuration = (tourId: number) =>
			tours.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration(next.id)).toBe(initialNextDuration);
		expect(directDuration(cancelledTour.id)).toBeNull();

		await cancelTour(cancelledTour.id, 'cancel', companyId);

		const tours2 = await getTours();
		const directDuration2 = (tourId: number) =>
			tours2.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration2(next.id)).toBeNull();
	});

	it('sets directDuration to null for tours which lose their predecessor due to request cancelation', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const start = Date.now() + HOUR;
		const initialNextDuration = await getDirectDuration(inNiesky3, inNiesky2);

		const cancelledTour = await addTour(
			oldVehicleId,
			customerId,
			start + 4 * MINUTE,
			start + 6 * MINUTE,
			inNiesky3,
			inNiesky3
		);
		const next = await addTour(
			oldVehicleId,
			customerId,
			start + 8 * MINUTE,
			start + 10 * MINUTE,
			inNiesky2,
			inNiesky3,
			initialNextDuration
		);

		const tours = await getTours();
		const directDuration = (tourId: number) =>
			tours.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration(next.id)).toBe(initialNextDuration);
		expect(directDuration(cancelledTour.id)).toBeNull();

		await cancelRequest(tours.find((t) => t.id === cancelledTour.id)!.requests[0].id, customerId);

		const tours2 = await getTours();
		const directDuration2 = (tourId: number) =>
			tours2.find((tour) => tour.id === tourId)?.directDuration;
		expect(directDuration2(next.id)).toBeNull();
	});
});
