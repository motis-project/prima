import type { Company, Vehicle } from './types';
import { Coordinates, Location } from './location';
import { MAX_MATCHING_DISTANCE, MAX_TRAVEL_SECONDS, MOTIS_BASE_URL } from './constants';
import { coordinatesToPlace, coordinatesToStr } from './motisUtils';
import { type Duration } from './motis/types.gen';
import { oneToMany as oneToManyMotis, plan as planMotis } from './motis/services.gen';
import { secondsToMs } from './time_utils';

export const getCompany = async (id: number): Promise<Company> => {
	const response = await fetch(`/api/company?id=${id}`);
	return await response.json();
};

export const getVehicles = async (company_id: number): Promise<Vehicle[]> => {
	const response = await fetch(`/api/vehicle?company=${company_id}`);
	return await response.json();
};

interface Message {
	message: string;
}

export const addVehicle = async (
	license_plate: string,
	seats: number,
	wheelchair_capacity: number,
	bike_capacity: number,
	storage_space: number
): Promise<[boolean, Message]> => {
	const response = await fetch('/api/vehicle', {
		method: 'POST',
		body: JSON.stringify({
			license_plate,
			seats,
			wheelchair_capacity,
			bike_capacity,
			storage_space
		})
	});
	return [response.ok, await response.json()];
};

export const updateTour = async (tourId: number, vehicleId: number) => {
	return await fetch('/api/tour', {
		method: 'POST',
		body: JSON.stringify({
			tour_id: tourId,
			vehicle_id: vehicleId
		})
	});
};

export const removeAvailability = async (vehicleId: number, from: Date, to: Date) => {
	return await fetch('/api/availability', {
		method: 'DELETE',
		body: JSON.stringify({
			vehicleId,
			from,
			to
		})
	});
};

export const addAvailability = async (vehicleId: number, from: Date, to: Date) => {
	return await fetch('/api/availability', {
		method: 'POST',
		body: JSON.stringify({
			vehicleId,
			from,
			to
		})
	});
};

export const booking = async (
	from: Location,
	to: Location,
	startFixed: boolean,
	timeStamp: Date,
	numPassengers: number,
	numWheelchairs: number,
	numBikes: number,
	luggage: number
) => {
	return await fetch('/api/booking', {
		method: 'POST',
		body: JSON.stringify({
			from,
			to,
			startFixed,
			timeStamp,
			numPassengers,
			numWheelchairs,
			numBikes,
			luggage
		})
	});
};

export const reassignTour = async (tourId: number) => {
	console.log('TODO: reassign tour:', tourId);
	return false;
};

export const plan = (from: Coordinates, to: Coordinates) => {
	return planMotis({
		baseUrl: MOTIS_BASE_URL,
		query: {
			fromPlace: coordinatesToPlace(from),
			toPlace: coordinatesToPlace(to),
			directModes: ['CAR'],
			transitModes: [],
			maxDirectTime: MAX_TRAVEL_SECONDS
		}
	});
};

export const oneToMany = async (
	one: Coordinates,
	many: Coordinates[],
	arriveBy: boolean
): Promise<number[]> => {
	return await oneToManyMotis({
		baseUrl: MOTIS_BASE_URL,
		query: {
			one: coordinatesToStr(one),
			many: many.map(coordinatesToStr),
			max: MAX_TRAVEL_SECONDS,
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			mode: 'CAR',
			arriveBy
		}
	}).then((res) => {
		return res.data!.map((d: Duration) => {
			return secondsToMs(d.duration ?? Number.MAX_VALUE);
		});
	});
};
