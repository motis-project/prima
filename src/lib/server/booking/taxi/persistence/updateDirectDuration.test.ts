import { db } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateDirectDurations } from './updateDirectDuration';

vi.mock('$lib/server/util/oneToManyCarRouting', () => ({
	oneToManyCarRouting: vi.fn()
}));

const capacities = { passengers: 4, bikes: 0, wheelchairs: 0, luggage: 4 };
const routedDuration = 12_000;

beforeEach(async () => {
	await clearDatabase();
	vi.mocked(oneToManyCarRouting).mockReset();
	vi.mocked(oneToManyCarRouting).mockResolvedValue([routedDuration]);
});

describe('updateDirectDurations', () => {
	it('does not select the moved tour as its own predecessor on the new vehicle', async () => {
		const companyId = await addCompany(1);
		const customerId = (await addTestUser()).id;
		const oldVehicleId = await addTaxi(companyId, capacities);
		const newVehicleId = await addTaxi(companyId, capacities);
		const departure = Date.now() + 60_000;
		const movedTour = await setTour(newVehicleId, departure, departure + 30_000);
		const requestId = (await setRequest(movedTour!.id, customerId, '')).id;
		await setEvent(requestId, departure + 5_000, true, 51.3, 14.8);
		await setEvent(requestId, departure + 25_000, false, 51.31, 14.81);

		await db.transaction().execute((trx) =>
			updateDirectDurations(oldVehicleId, movedTour!.id, departure, trx, newVehicleId)
		);

		const tours = await getTours();
		expect(tours.find((tour) => tour.id === movedTour!.id)?.directDuration).toBeNull();
		expect(oneToManyCarRouting).not.toHaveBeenCalled();
	});
});
