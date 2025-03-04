import { CAP, FIXED_PRICE, OVER_CAP_FACTOR } from '$lib/constants';
import type { VehicleId } from '$lib/server/booking/VehicleId';
import { db } from '$lib/server/db';
import { getToursWithRequests, type TourWithRequests } from '$lib/server/db/getTours';
import { Interval } from '$lib/server/util/interval';
import { groupBy } from '$lib/util/groupBy';
import { DAY, HOUR } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export async function getCompanyCosts() {
	const iterateIntervalArrays = <T, U>(
		arr1: Interval[],
		arr2: T[],
		toInterval: (t: T) => Interval,
		onOverlap: (idx1: number, v2: T, maps: Map<VehicleId, U>[]) => void
	) => {
		const maps = new Array<Map<VehicleId, U>>(arr1.length);
		if (arr1.length === 0 || arr2.length === 0) {
			return maps;
		}
		let idx1 = 0;
		let idx2 = 0;
		let v1 = arr1[0];
		let v2 = arr2[0];
		let interval = toInterval(v2);
		maps[0] = new Map<VehicleId, U>();
		while (idx1 < arr1.length && idx2 < arr2.length) {
			if (v1.overlaps(interval)) {
				onOverlap(idx1, v2, maps);
			}
			if (v1.endTime < interval.endTime) {
				v1 = arr1[++idx1];
				if (idx1 < arr1.length) {
					maps[idx1] = new Map<VehicleId, U>();
				}
			} else {
				v2 = arr2[++idx2];
				if (idx2 < arr2.length) {
					interval = toInterval(v2);
				}
			}
		}
		return maps;
	};

	const tours: (TourWithRequests & { interval: Interval })[] = (
		await getToursWithRequests(false)
	).map((t) => {
		return {
			...t,
			interval: new Interval(t.startTime, t.endTime)
		};
	});
	tours.sort((t1, t2) => t1.startTime - t2.startTime);
	if (tours.length === 0) {
		return {
			tours: [],
			earliestTime: Date.now(),
			companyCostsPerDay: []
		};
	}
	const earliestTime =
		Math.floor(
			tours.reduce((min, entry) => (entry.startTime < min.startTime ? entry : min), tours[0])
				.startTime / DAY
		) * DAY;

	const today = Math.ceil(Date.now() / DAY) * DAY;
	const availabilities = await db
		.selectFrom('availability')
		.where('availability.endTime', '>=', earliestTime)
		.where('availability.startTime', '<=', today)
		.select(['availability.vehicle as vehicleId', 'availability.startTime', 'availability.endTime'])
		.execute();

	// create an array of intervals representing the individual days in the two relevant years
	const days = Array.from(
		{ length: Math.floor((today - earliestTime) / DAY) },
		(_, i) => new Interval(earliestTime + DAY * i, earliestTime + DAY * (i + 1))
	);

	// group availabilities by vehicle
	const availabilitiesPerVehicle = groupBy(
		availabilities,
		(a) => a.vehicleId,
		(a) => new Interval(a.startTime, a.endTime)
	);
	// merge availabilities belonging to same vehicle
	availabilitiesPerVehicle.forEach((availabilities, vehicle) =>
		availabilitiesPerVehicle.set(vehicle, Interval.merge(availabilities))
	);

	// get list of all merged availabilities
	const allAvailabilities = Array.from(availabilitiesPerVehicle).flatMap(([vehicleId, intervals]) =>
		intervals.map((interval) => ({ vehicleId, interval }))
	);

	allAvailabilities.sort((a1, a2) => a1.interval.startTime - a2.interval.startTime);
	// cumulate the total duration of availability on every relevant day for each vehicle
	const availabilitiesPerDayAndVehicle = iterateIntervalArrays(
		days,
		allAvailabilities,
		(a) => a.interval,
		(
			dayIdx: number,
			availability: {
				vehicleId: number;
				interval: Interval;
			},
			maps: Map<VehicleId, number>[]
		) =>
			maps[dayIdx].set(
				availability.vehicleId,
				(maps[dayIdx].get(availability.vehicleId) ?? 0) +
					(days[dayIdx].intersect(availability.interval)?.getDurationMs() ?? 0)
			)
	);

	// cumulate the total taxameter readings on every relevant day for each vehicle
	const taxameterPerDayAndVehicle = iterateIntervalArrays(
		days,
		tours,
		(t: TourWithRequests & { interval: Interval }) => t.interval,
		(
			idx1,
			v2,
			maps: Map<VehicleId, { taxameter: number; customerCount: number; timestamp: UnixtimeMs }>[]
		) => {
			maps[idx1].set(v2.vehicleId, {
				taxameter: (maps[idx1].get(v2.vehicleId)?.taxameter ?? 0) + (v2.fare ?? 0),
				customerCount:
					(maps[idx1].get(v2.vehicleId)?.customerCount ?? 0) +
					v2.requests.reduce((acc, current) => current.passengers + acc, 0),
				timestamp: v2.startTime
			});
		}
	);

	const costPerDayAndVehicle = new Array<
		Map<
			VehicleId,
			{
				taxameter: number;
				uncapped: number;
				capped: number;
				customerCount: number;
				timestamp: UnixtimeMs;
			}
		>
	>();
	for (let d = 0; d != days.length; ++d) {
		costPerDayAndVehicle[d] = new Map<
			VehicleId,
			{
				taxameter: number;
				uncapped: number;
				capped: number;
				customerCount: number;
				timestamp: UnixtimeMs;
			}
		>();
		if (taxameterPerDayAndVehicle[d] == undefined) {
			continue;
		}
		taxameterPerDayAndVehicle[d].forEach((taxameter, vehicle) => {
			const costCap = ((availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0) * CAP) / HOUR;
			const uncapped = taxameter.taxameter - taxameter.customerCount * FIXED_PRICE;
			const cost = Math.min(costCap, uncapped) + Math.max(uncapped - costCap, 0) * OVER_CAP_FACTOR;
			costPerDayAndVehicle[d].set(vehicle, {
				uncapped: uncapped,
				taxameter: taxameter.taxameter,
				capped: cost,
				customerCount: taxameter.customerCount,
				timestamp: taxameter.timestamp
			});
		});
	}
	const companyByVehicle = new Map<number, { name: string | null; id: number }>();
	tours.forEach((t) => companyByVehicle.set(t.vehicleId, { name: t.companyName, id: t.companyId }));

	// Gather the daily (soft-capped and uncapped) costs per day and company
	const companyCostsPerDay = new Array<
		Map<
			number,
			{
				taxameter: number;
				capped: number;
				uncapped: number;
				companyName: string | null;
				availabilityDuration: number;
				customerCount: number;
				timestamp: UnixtimeMs;
			}
		>
	>();
	for (let d = 0; d != days.length; ++d) {
		companyCostsPerDay[d] = new Map<
			number,
			{
				taxameter: number;
				capped: number;
				uncapped: number;
				companyName: string | null;
				availabilityDuration: number;
				customerCount: number;
				timestamp: UnixtimeMs;
			}
		>();
		if (costPerDayAndVehicle[d] === undefined) {
			continue;
		}
		costPerDayAndVehicle[d].forEach((cost, vehicle) => {
			const company = companyByVehicle.get(vehicle)!;
			companyCostsPerDay[d].set(company.id, {
				capped: (companyCostsPerDay[d].get(company.id)?.capped ?? 0) + cost.capped,
				uncapped:
					(companyCostsPerDay[d].get(company.id)?.uncapped ?? 0) +
					(costPerDayAndVehicle[d].get(vehicle)?.uncapped ?? 0),
				companyName: company.name,
				availabilityDuration:
					(companyCostsPerDay[d].get(company.id)?.availabilityDuration ?? 0) +
					(availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0),
				customerCount:
					(companyCostsPerDay[d].get(company.id)?.customerCount ?? 0) +
					(costPerDayAndVehicle[d].get(vehicle)?.customerCount ?? 0),
				taxameter: (companyCostsPerDay[d].get(company.id)?.taxameter ?? 0) + cost.taxameter,
				timestamp: cost.timestamp
			});
		});
	}
	return {
		tours,
		earliestTime,
		companyCostsPerDay: companyCostsPerDay.flatMap((companyCosts) =>
			Array.from(companyCosts).map(
				([
					companyId,
					{
						capped,
						uncapped,
						companyName,
						availabilityDuration,
						customerCount,
						taxameter,
						timestamp
					}
				]) => {
					return {
						companyId,
						capped,
						uncapped,
						companyName,
						availabilityDuration,
						customerCount,
						taxameter,
						timestamp
					};
				}
			)
		)
	};
}
