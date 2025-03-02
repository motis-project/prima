import type { UnixtimeMs } from '$lib/util/UnixtimeMs';
import type { VehicleId } from '../booking/VehicleId';
import { groupBy } from '../../util/groupBy';
import { Interval } from './interval';

export function mergeAvailabilities(
	availabilities: {
		vehicleId: VehicleId;
		startTime: UnixtimeMs;
		endTime: UnixtimeMs;
	}[]
): Map<VehicleId, Interval[]> {
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
	return availabilitiesPerVehicle;
}
