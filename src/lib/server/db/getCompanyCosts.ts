import { CAP, FIXED_PRICE, OVER_CAP_FACTOR } from '$lib/constants';
import type { VehicleId } from '$lib/server/booking/VehicleId';
import { db } from '$lib/server/db';
import { getToursWithRequests } from '$lib/server/db/getTours';
import type { TourWithRequests } from '$lib/util/getToursTypes';
import { Interval } from '$lib/server/util/interval';
import { groupBy } from '$lib/util/groupBy';
import { DAY, HOUR } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export async function getCompanyCosts(companyId?: number) {
	const tours: (TourWithRequests & { interval: Interval })[] = (
		await getToursWithRequests(true, companyId)
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
			latestTime: Date.now(),
			companyCostsPerDay: []
		};
	}
	const earliestTime =
		tours.reduce((min, entry) => (entry.startTime < min.startTime ? entry : min), tours[0])
			.startTime - DAY;
	const latestTime =
		tours.reduce((max, entry) => (entry.endTime > max.endTime ? entry : max), tours[0]).endTime +
		DAY;
	const availabilities = await db
		.selectFrom('availability')
		.innerJoin('vehicle', 'vehicle.id', 'availability.vehicle')
		.$if(companyId != undefined, (qb) => qb.where('vehicle.company', '=', companyId!))
		.where('availability.endTime', '>=', earliestTime)
		.where('availability.startTime', '<=', latestTime)
		.select(['availability.vehicle as vehicleId', 'availability.startTime', 'availability.endTime'])
		.orderBy('availability.endTime', 'asc')
		.execute();

	// create an array of intervals representing the individual days in the two relevant years
	const getOffset = (t: UnixtimeMs) => {
		return (
			parseInt(
				new Date(t).toLocaleString('de-DE', {
					hour: '2-digit',
					hour12: false,
					timeZone: 'Europe/Berlin'
				})
			) - 12
		);
	};
	const firstDay = new Date(earliestTime - DAY);
	const firstDayStart = Math.floor(firstDay.getTime() / DAY) * DAY;
	const days = Array.from({ length: Math.ceil((latestTime - firstDayStart) / DAY) }, (_, i) => {
		const offset = getOffset(firstDayStart + DAY * i + HOUR * 12);
		const offsetNextDay = getOffset(firstDayStart + DAY * (i + 1) + HOUR * 12);
		return new Interval(
			firstDayStart + DAY * i - offset * HOUR,
			firstDayStart + DAY * (i + 1) - offsetNextDay * HOUR
		);
	});
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
	// cumulate the total duration of availability on every relevant day for each vehicle
	const availabilitiesPerDayAndVehicle = new Array<Map<number, number>>(days.length);
	days.forEach((day, dayIdx) => {
		availabilitiesPerDayAndVehicle[dayIdx] = new Map<number, number>();
		availabilitiesPerVehicle.forEach((availabilities, vehicle) =>
			availabilities.forEach((availability) => {
				if (day.overlaps(availability)) {
					availabilitiesPerDayAndVehicle[dayIdx].set(
						vehicle,
						(availabilitiesPerDayAndVehicle[dayIdx].get(vehicle) ?? 0) +
							availability.getDurationMs()
					);
				}
			})
		);
	});

	// cumulate the total taxameter readings on every relevant day for each vehicle
	const taxameterPerDayAndVehicle = new Array<
		Map<
			number,
			{
				taxameter: number;
				customerCount: number;
				timestamp: UnixtimeMs;
				verifiedCustomerCount: number;
			}
		>
	>(days.length);
	days.forEach((day, dayIdx) => {
		taxameterPerDayAndVehicle[dayIdx] = new Map<
			number,
			{
				taxameter: number;
				customerCount: number;
				timestamp: UnixtimeMs;
				verifiedCustomerCount: number;
			}
		>();
		tours.forEach((tour) => {
			if (day.overlaps(tour.interval)) {
				taxameterPerDayAndVehicle[dayIdx].set(tour.vehicleId, {
					taxameter:
						(taxameterPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.taxameter ?? 0) +
						(tour.fare ?? 0),
					customerCount:
						(taxameterPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.customerCount ?? 0) +
						tour.requests.reduce((acc, current) => current.passengers + acc, 0),
					timestamp: tour.startTime,
					verifiedCustomerCount:
						(taxameterPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.verifiedCustomerCount ?? 0) +
						tour.requests.reduce(
							(acc, current) => (current.ticketChecked ? current.passengers : 0) + acc,
							0
						)
				});
			}
		});
	});
	const costPerDayAndVehicle = new Array<
		Map<
			VehicleId,
			{
				taxameter: number;
				uncapped: number;
				capped: number;
				customerCount: number;
				timestamp: UnixtimeMs;
				verifiedCustomerCount: number;
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
				verifiedCustomerCount: number;
			}
		>();
		if (taxameterPerDayAndVehicle[d] == undefined) {
			continue;
		}
		taxameterPerDayAndVehicle[d].forEach((taxameter, vehicle) => {
			const costCap = ((availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0) * CAP) / HOUR;
			const uncapped = taxameter.taxameter - taxameter.verifiedCustomerCount * FIXED_PRICE;
			const capped =
				Math.min(costCap, uncapped) + Math.max(uncapped - costCap, 0) * OVER_CAP_FACTOR;
			costPerDayAndVehicle[d].set(vehicle, {
				uncapped,
				taxameter: taxameter.taxameter,
				capped,
				customerCount: taxameter.customerCount,
				timestamp: taxameter.timestamp,
				verifiedCustomerCount: taxameter.verifiedCustomerCount
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
				verifiedCustomerCount: number;
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
				verifiedCustomerCount: number;
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
				verifiedCustomerCount:
					(companyCostsPerDay[d].get(company.id)?.verifiedCustomerCount ?? 0) +
					(costPerDayAndVehicle[d].get(vehicle)?.verifiedCustomerCount ?? 0),
				taxameter: (companyCostsPerDay[d].get(company.id)?.taxameter ?? 0) + cost.taxameter,
				timestamp: cost.timestamp
			});
		});
	}
	return {
		tours,
		earliestTime,
		latestTime,
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
						timestamp,
						verifiedCustomerCount
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
						timestamp,
						verifiedCustomerCount
					};
				}
			)
		)
	};
}
