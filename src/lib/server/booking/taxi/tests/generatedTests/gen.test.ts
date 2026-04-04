import { describe, expect, it } from 'vitest';
import { getNextWednesday, prepareTest, white } from '$lib/server/booking/testUtils';
import { addCompany, addTaxi, getTours, setAvailability, Zone } from '$lib/testHelpers';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { db } from '$lib/server/db';
import type { Condition } from '$lib/util/booking/testParams';
import { tests } from './testJsons';
import { isSamePlace } from '$lib/util/booking/isSamePlace';
import { Mode } from '$lib/server/booking/mode';

const filterByUuid: string | undefined = undefined;
function filterByContainedEvent(
	tours: {
		id: number;
		requests: { events: { lat: number; lng: number; scheduledTimeStart: number }[] }[];
	}[],
	condition: Condition
) {
	return tours.filter((t) =>
		t.requests.some(
			(r) =>
				(condition.start !== null && r.events.some((e) => isSamePlace(e, condition.start!))) ||
				(condition.destination !== null &&
					r.events.some((e) => isSamePlace(e, condition.destination!)))
		)
	);
}

describe('Concatenation tests', () => {
	it('generated tests', async () => {
		console.log({ testparams: JSON.stringify(tests, null, '\t') });
		let skipped = 0;
		for (const test of tests) {
			if (filterByUuid !== undefined && filterByUuid !== test.uuid) {
				skipped++;
				continue;
			}
			console.log('Running test with', { link: `http://localhost:5173/tests?test=${test.uuid}` });
			expect(test.process.starts.length).toBe(test.process.destinations.length);
			expect(test.process.starts.length).toBe(test.process.isDepartures.length);
			expect(test.process.starts.length).toBe(test.process.times.length);
			const mockUserId = await prepareTest();
			for (const company of test.process.companies) {
				const c = await addCompany(Zone.WEIßWASSER, company);
				for (let taxiIdx = 0; taxiIdx != 10; ++taxiIdx) {
					const taxi = await addTaxi(c, { passengers: 3, luggage: 0, wheelchairs: 0, bikes: 0 });
					await setAvailability(taxi, 0, 8640000000000000);
				}
			}
			const times = test.process.times.map((t) =>
				getNextWednesday(new Date(t), new Date(Date.now()))
			);
			for (let requestIdx = 0; requestIdx != test.process.starts.length; ++requestIdx) {
				const body = JSON.stringify({
					start: test.process.starts[requestIdx],
					target: test.process.destinations[requestIdx],
					startBusStops: [],
					targetBusStops: [],
					directTimes: [times[requestIdx]],
					startFixed: test.process.isDepartures[requestIdx],
					capacities: { passengers: 1, luggage: 0, wheelchairs: 0, bikes: 0 }
				});
				const whiteResponse = await white(body).then((r) => r.json());
				const connection1: ExpectedConnection = {
					start: { ...test.process.starts[requestIdx], address: 'start address' },
					target: { ...test.process.destinations[requestIdx], address: 'target address' },
					startTime: whiteResponse.direct[0].pickupTime,
					targetTime: whiteResponse.direct[0].dropoffTime,
					signature: '',
					startFixed: false,
					requestedTime: times[requestIdx],
					mode: Mode.TAXI
				};
				const bookingBody = {
					connection1,
					connection2: null,
					capacities: { passengers: 1, luggage: 0, wheelchairs: 0, bikes: 0 }
				};
				await bookingApi(bookingBody, mockUserId, false, true, 0, 0, 0, 0, true);
				const tours = await getTours();
				for (const condition of test.conditions.filter((c) => c.evalAfterStep === requestIdx)) {
					try {
						switch (condition.entity) {
							case 'requestCount':
								expect(tours.flatMap((t) => t.requests).length).toBe(condition.requestCount);
								break;
							case 'tourCount':
								expect(tours.length).toBe(condition.tourCount);
								break;
							case 'startPosition': {
								const events = filterByContainedEvent(tours, condition)[0]
									.requests.flatMap((r) => r.events)
									.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
								expect(events[condition.expectedPosition!].lat).toBe(condition.start?.lat);
								expect(events[condition.expectedPosition!].lng).toBe(condition.start?.lng);
								break;
							}
							case 'destinationPosition': {
								const events = filterByContainedEvent(tours, condition)[0]
									.requests.flatMap((r) => r.events)
									.sort((e1, e2) => e1.scheduledTimeStart - e2.scheduledTimeStart);
								expect(events[condition.expectedPosition!].lat).toBe(condition.destination?.lat);
								expect(events[condition.expectedPosition!].lng).toBe(condition.destination?.lng);
								break;
							}
							case 'requestCompanyMatch': {
								const toursWithCorrectRequest = filterByContainedEvent(tours, condition);
								console.log({ toursWithCorrectRequest });
								const companiesWithCorrectRequest = await db
									.selectFrom('tour')
									.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
									.innerJoin('company', 'company.id', 'vehicle.company')
									.where(
										'tour.id',
										'in',
										toursWithCorrectRequest.map((t) => t.id)
									)
									.select(['company.lat', 'company.lng'])
									.execute();
								expect(
									companiesWithCorrectRequest.filter((c) =>
										isSamePlace({ lat: c.lat!, lng: c.lng! }, condition.company!)
									).length
								).not.toBe(0);
								break;
							}
							default:
								expect(false).toBeTruthy();
						}
					} catch (err) {
						console.error(
							`❌ Condition failed:`,
							{ condition },
							{ link: `http://localhost:5173/tests?test=${test.uuid}` }
						);
						throw err;
					}
				}
			}
		}
		console.log(`Successfully ran ${tests.length - skipped} tests. Skipped ${skipped} tests.`);
	}, 50000);
});
