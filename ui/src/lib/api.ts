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
	return await response.json();
};
