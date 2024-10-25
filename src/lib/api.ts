import type { Company, Vehicle } from './types';
import { Coordinates, Location } from './location';

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

export class AddressGuess {
	pos!: { lat: number; lng: number };
}

export async function geoCode(address: string): Promise<AddressGuess> {
	const response = await fetch('https://europe.motis-project.de/?elm=AddressSuggestions', {
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			destination: { type: 'Module', target: '/address' },
			content_type: 'AddressRequest',
			content: { input: address }
		}),
		method: 'POST',
		mode: 'cors'
	}).then((res) => res.json());
	const guesses = response.content.guesses;
	if (guesses.length == 0) {
		throw new Error('geoCode did not return any address guesses.');
	}
	return guesses[0];
}
