import type { Company, Vehicle } from './types';

export const getCompany = async (id: number): Promise<Company> => {
	const response = await fetch(`/api/company?id=${id}`);
	return await response.json();
};

export const getVehicles = async (company_id: number): Promise<Vehicle[]> => {
	const response = await fetch(`/api/vehicle?company=${company_id}`);
	return await response.json();
};

export const addVehicle = async (
	license_plate: string,
	company: number,
	seats: number,
	wheelchair_capacity: number,
	bike_capacity: number,
	storage_space: number
): Promise<Response> => {
	const response = await fetch('/api/vehicle/', {
		method: 'POST',
		body: JSON.stringify({
			license_plate,
			company,
			seats,
			wheelchair_capacity,
			bike_capacity,
			storage_space
		})
	});
	return response;
};

export const updateTour = async (tour_id: number, vehicle_id: number): Promise<Response> => {
	const response = await fetch('/api/tour/', {
		method: 'POST',
		body: JSON.stringify({
			tour_id,
			vehicle_id
		})
	});
	return response;
};

export const removeAvailability = async (vehicle_id: number, from: Date, to: Date) => {
	const response = await fetch('/api/availability/', {
		method: 'DELETE',
		body: JSON.stringify({
			vehicle_id,
			from,
			to
		})
	});
	return response;
};

export const addAvailability = async (vehicle_id: number, from: Date, to: Date) => {
	const response = await fetch('/api/availability/', {
		method: 'POST',
		body: JSON.stringify({
			vehicle_id,
			from,
			to
		})
	});
	return response;
};

export async function geoCode(address: string) {
	const response = await fetch('https://europe.motis-project.de/?elm=AddressSuggestions', {
		credentials: 'omit',
		headers: {
			'Content-Type': 'application/json'
		},
		referrer: 'https://europe.motis-project.de/',
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
		throw new Error('There were no address guesses.');
	}
	return guesses[0];
}
