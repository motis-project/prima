import { CAP, FIXED_PRICE, OVER_CAP_FACTOR } from '$lib/constants';
import { db } from '$lib/server/db';
import { getToursWithRequests } from '$lib/server/db/getTours';
import type { TourWithRequests } from '$lib/util/getToursTypes';
import { Interval } from '$lib/util/interval';
import { groupBy } from '$lib/util/groupBy';
import { DAY, HOUR, roundToUnit } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import { getOffset } from '$lib/util/getOffset';

export async function getCompanyCosts(companyId?: number, tourId?: number) {
	let tours: (TourWithRequests & { interval: Interval })[] = (
		await getToursWithRequests(true, companyId)
	).map((t) => {
		return {
			...t,
			interval: new Interval(t.startTime, t.endTime)
		};
	});
	if (tourId !== undefined) {
		tours = tours.filter((t) => t.tourId === tourId);
	}
	tours.sort((t1, t2) => t1.startTime - t2.startTime);
	if (tours.length === 0) {
		return {
			tours: [],
			earliestTime: Date.now(),
			latestTime: Date.now(),
			costPerDayAndVehicle: []
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
	const firstDay = new Date(earliestTime - DAY);
	const firstDayStart = roundToUnit(firstDay.getTime(), DAY, Math.floor);
	const days = Array.from({ length: Math.ceil((latestTime - firstDayStart) / DAY) }, (_, i) => {
		const offset = getOffset(firstDayStart + DAY * i + HOUR * 12);
		const offsetNextDay = getOffset(firstDayStart + DAY * (i + 1) + HOUR * 12);
		return new Interval(
			firstDayStart + DAY * i - offset,
			firstDayStart + DAY * (i + 1) - offsetNextDay
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
							(day.intersect(availability)?.getDurationMs() ?? 0)
					);
				}
			})
		);
	});

	const companyByVehicle = new Map<
		number,
		{ name: string | null; id: number; licensePlate: string }
	>();
	tours.forEach((t) =>
		companyByVehicle.set(t.vehicleId, {
			name: t.companyName,
			id: t.companyId,
			licensePlate: t.licensePlate
		})
	);

	// cumulate the total taxameter readings on every relevant day for each vehicle
	const costPerDayAndVehicle = new Array<
		Map<
			number,
			{
				taxameter: number;
				uncapped: number;
				capped: number;
				customerCount: number;
				timestamp: UnixtimeMs;
				verifiedCustomerCount: number;
				availabilityDuration: UnixtimeMs;
				companyName: string | null;
				licensePlate: string;
				companyId: number;
			}
		>
	>(days.length);
	days.forEach((day, dayIdx) => {
		costPerDayAndVehicle[dayIdx] = new Map<
			number,
			{
				taxameter: number;
				uncapped: number;
				capped: number;
				customerCount: number;
				timestamp: UnixtimeMs;
				verifiedCustomerCount: number;
				availabilityDuration: UnixtimeMs;
				companyName: string | null;
				licensePlate: string;
				companyId: number;
			}
		>();
		tours.forEach((tour) => {
			if (day.overlaps(tour.interval)) {
				const tourTaxameter = tour.fare ?? 0;
				const tourVerifiedCustomerCount = tour.requests.reduce(
					(acc, current) =>
						(current.ticketChecked
							? current.passengers -
								current.kidsZeroToTwo -
								current.kidsThreeToFour -
								current.kidsFiveToSix
							: 0) + acc,
					0
				);
				costPerDayAndVehicle[dayIdx].set(tour.vehicleId, {
					taxameter:
						(costPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.taxameter ?? 0) + tourTaxameter,
					customerCount:
						(costPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.customerCount ?? 0) +
						tour.requests.reduce((acc, current) => current.passengers + acc, 0),
					timestamp: tour.startTime,
					verifiedCustomerCount:
						(costPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.verifiedCustomerCount ?? 0) +
						tourVerifiedCustomerCount,
					uncapped:
						(costPerDayAndVehicle[dayIdx].get(tour.vehicleId)?.uncapped ?? 0) +
						(!tour.cancelled &&
						tour.fare !== null &&
						!tour.requests.flatMap((request) => request.events).some((e) => e.ticketChecked) &&
						tour.endTime > Date.now()
							? 0
							: (tourVerifiedCustomerCount === 0 ? 0 : tourTaxameter) -
								tourVerifiedCustomerCount * FIXED_PRICE),
					availabilityDuration: availabilitiesPerDayAndVehicle[dayIdx].get(tour.vehicleId) ?? 0,
					companyName: companyByVehicle.get(tour.vehicleId)!.name,
					licensePlate: companyByVehicle.get(tour.vehicleId)!.licensePlate,
					companyId: companyByVehicle.get(tour.vehicleId)!.id,
					capped: 0
				});
			}
		});
	});
	for (let d = 0; d != days.length; ++d) {
		if (costPerDayAndVehicle[d] == undefined) {
			continue;
		}
		costPerDayAndVehicle[d].forEach((taxameter, vehicle) => {
			const costCap = ((availabilitiesPerDayAndVehicle[d]?.get(vehicle) ?? 0) * CAP) / HOUR;
			const dayVehicleCost = costPerDayAndVehicle[d].get(vehicle);
			if (dayVehicleCost) {
				dayVehicleCost.capped =
					Math.min(costCap, taxameter.uncapped) +
					Math.max(taxameter.uncapped - costCap, 0) * OVER_CAP_FACTOR;
			}
		});
	}
	return {
		tours,
		earliestTime,
		latestTime,
		costPerDayAndVehicle: costPerDayAndVehicle.flatMap((vehicleCosts) =>
			Array.from(vehicleCosts).map(
				([
					vehicleId,
					{
						companyId,
						capped,
						uncapped,
						companyName,
						availabilityDuration,
						customerCount,
						taxameter,
						timestamp,
						verifiedCustomerCount,
						licensePlate
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
						verifiedCustomerCount,
						vehicleId,
						licensePlate,
						overCap: Math.max(
							verifiedCustomerCount === 0 ? 0 : uncapped - (availabilityDuration / HOUR) * CAP,
							0
						)
					};
				}
			)
		)
	};
}
