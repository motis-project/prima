import { CAP, FIXED_PRICE, OVER_CAP_FACTOR } from '$lib/constants';
import type { VehicleId } from '$lib/server/booking/VehicleId';
import { db } from '$lib/server/db';
import { getTours, type Tour } from '$lib/server/db/getTours';
import { groupBy } from '$lib/server/util/groupBy';
import { Interval } from '$lib/server/util/interval';
import { DAY, HOUR } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export const load = async () => {
	function isLeapYear(year: number): boolean {
		return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  	}
	const todayEnd = (Math.floor(Date.now() / DAY) + 1) * DAY;
	const year = new Date(todayEnd).getUTCFullYear();
	const firstOfJanuaryLastYear = new Date(year - 1, 0, 1).getTime();

	const tours = (await getTours(false)).map((t) => {
		return {
			...t,
			interval: new Interval(t.startTime, t.endTime)
		};
	});
	tours.sort((t1, t2) => t1.startTime - t2.startTime);
	return {
		tours: tours.map(({ interval, ...rest }) => rest),
		firstOfJanuaryLastYear,
		isLeapYear: isLeapYear(year),
		lastIsLeapYear: isLeapYear(year - 1),
		companyCostsPerDay: await getCompanyCosts(todayEnd, firstOfJanuaryLastYear, tours)
	};
};

async function getCompanyCosts(today: UnixtimeMs, firstOfJanuaryLastYear: UnixtimeMs, tours: (Tour & { interval: Interval })[]){
	const availabilities = await db
		.selectFrom('availability')
		.where('availability.endTime', '>=', firstOfJanuaryLastYear)
		.where('availability.startTime', '<=', today)
		.select(['availability.vehicle as vehicleId', 'availability.startTime', 'availability.endTime'])
		.execute();

	// create an array of intervals representing the individual days in the two relevant years
	const days = Array.from(
		{ length: Math.floor((today - firstOfJanuaryLastYear) / DAY) }, 
		(_, i) => new Interval(firstOfJanuaryLastYear + DAY * i, firstOfJanuaryLastYear + DAY * (i + 1))
	  );

	// group Intervals by vehicle
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

	allAvailabilities.sort((a1, a2) => {
		const startDayCmp = Math.floor(a1.interval.startTime/DAY) - Math.floor(a2.interval.startTime/DAY);
		return startDayCmp === 0 ? a1.interval.endTime - a2.interval.endTime : startDayCmp;
	});

	// cumulate the total duration of availability on every relevant day for each vehicle
	const availabilitiesPerDayAndVehicle = new Array<Map<VehicleId, number>>();
	let availabilityIdx = 0;
	let currentAvailability = allAvailabilities[0];
	for (let d = 410; d != days.length; ++d) {
		availabilitiesPerDayAndVehicle[d] = new Map<VehicleId, number>();
		const day = days[d];
		while(availabilityIdx != allAvailabilities.length && currentAvailability.interval.endTime <= day.startTime) {
			currentAvailability = allAvailabilities[++availabilityIdx];
		}
		if(availabilityIdx == allAvailabilities.length) {
			break;
		}
		const oldAvailabilityIdx = availabilityIdx;
		let availabilityOnDay = day.intersect(currentAvailability.interval);
		while (availabilityIdx != allAvailabilities.length && availabilityOnDay !== undefined) {
			availabilitiesPerDayAndVehicle[d].set(
				currentAvailability.vehicleId,
				(availabilitiesPerDayAndVehicle[d].get(currentAvailability.vehicleId) ?? 0) +
					availabilityOnDay.getDurationMs()
			);
			currentAvailability = allAvailabilities[++availabilityIdx];
			if(availabilityIdx !== allAvailabilities.length) {
				availabilityOnDay = day.intersect(currentAvailability.interval);
			}
		}
		availabilityIdx = oldAvailabilityIdx;
		currentAvailability = allAvailabilities[availabilityIdx];
	}

	// cumulate the total taxameter readings on every relevant day for each vehicle
	const taxameterPerDayAndVehicle = new Array<Map<VehicleId, number>>();
	let tourIdx = 0;
	let currentTour = tours[0];
	for (let d = 0; d != days.length; ++d) {
		if(currentTour === undefined) {
			break;
		}
		taxameterPerDayAndVehicle[d] = new Map<VehicleId, number>();
		while (currentTour != undefined && days[d].intersect(currentTour.interval)) {
			taxameterPerDayAndVehicle[d].set(
				currentTour.vehicleId,
				(taxameterPerDayAndVehicle[d].get(currentTour.vehicleId) ?? 0) + (currentTour.fare ?? 0)
			);
			currentTour = tours[++tourIdx];
		}
	}

	// compute the cost per vehicle and day, taking into account the daily cap based on the availability on the day
	const costPerDayAndVehicle = new Array<Map<VehicleId, number>>();
	for (let d = 0; d != days.length; ++d) {
		costPerDayAndVehicle[d] = new Map<VehicleId, number>();
		taxameterPerDayAndVehicle[d].forEach((taxameter, vehicle) => {
			const costCap = ((availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0) * CAP) / HOUR;
			const cost =
				Math.min(costCap, taxameter - FIXED_PRICE) + Math.max(taxameter - FIXED_PRICE - costCap, 0) * OVER_CAP_FACTOR;
			costPerDayAndVehicle[d].set(vehicle, cost);
		});
	}

	const companyByVehicle = new Map<number, { name: string|null, id: number }>();
	tours.forEach((t) => companyByVehicle.set(t.vehicleId, {name:t.companyName, id: t.companyId}));

	// Gather the daily (soft-capped and uncapped) costs per day and company
	const companyCostsPerDay = new Array<Map<number, {capped: number, uncapped: number, companyName: string | null, availabilityDuration: number }>>();
	for (let d = 0; d != days.length; ++d) {
		companyCostsPerDay[d] = new Map<number, {capped: number, uncapped: number, companyName: string | null, availabilityDuration: number }>();
		if(costPerDayAndVehicle[d] === undefined) {
			continue;
		}
		costPerDayAndVehicle[d].forEach((cost, vehicle) => {
			const company = companyByVehicle.get(vehicle)!;
			companyCostsPerDay[d].set(company.id, {
				capped: (companyCostsPerDay[d].get(company.id)?.capped ?? 0) + cost,
				uncapped: (companyCostsPerDay[d].get(company.id)?.uncapped ?? 0) + (taxameterPerDayAndVehicle[d].get(vehicle) ?? 0),
				companyName: company.name,
				availabilityDuration: (companyCostsPerDay[d].get(company.id)?.availabilityDuration ?? 0) + (availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0)
			});
		});
	}
	return companyCostsPerDay.flatMap((companyCosts, day) =>
		Array.from(companyCosts).map(([companyId, {capped, uncapped, companyName, availabilityDuration}]) => {
			return {
				companyId,
				capped,
				uncapped,
				day,
				companyName,
				availabilityDuration
			};
		})
	);
}
