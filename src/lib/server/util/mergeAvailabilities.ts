import type { UnixtimeMs } from "$lib/util/UnixtimeMs";
import type { VehicleId } from "../booking/VehicleId";
import { groupBy } from "./groupBy";
import { Interval } from "./interval";

//TODO schauen, wie ich das anpassen kann damit es für nils und mich passend/einfach ist
type valueType = {
    Intervals: Interval[],
    company: number
}

export function mergeAvailabilities(availabilities: {
    vehicleId: VehicleId,
    startTime: UnixtimeMs,
    endTime: UnixtimeMs,
    company: number | undefined
}[]): Map<VehicleId, Interval[]> {
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