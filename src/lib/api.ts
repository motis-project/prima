import type { Company, Vehicle } from './types';

export const getCompany = async (id: number): Promise<Company> => {
	const response = await fetch(`/api/company?id=${id}`);
	return await response.json();
};

export const getVehicles = async (company_id: number): Promise<Vehicle[]> => {
	const response = await fetch(`/api/vehicle?company=${company_id}`);
	return await response.json();
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

export async function geoMotis(address: string) {
	const response = await fetch('https://europe.motis-project.de/?elm=AddressSuggestions', {
		credentials: 'omit',
		headers: {
			'User-Agent':
				'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Content-Type': 'application/json',
			'Alt-Used': 'europe.motis-project.de',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin'
		},
		referrer: 'https://europe.motis-project.de/',
		body: `{"destination":{"type":"Module","target":"/address"},"content_type":"AddressRequest","content":{"input":"${address}"}}`,
		method: 'POST',
		mode: 'cors'
	}).then((res) => res.json());
	const guesses = response.content.guesses;
	if (guesses.length == 0) {
		return new Response();
	}
	return guesses;
}
