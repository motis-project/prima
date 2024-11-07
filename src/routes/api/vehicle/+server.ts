import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';

export const POST = async (event) => {
	const company = event.locals.user?.company;
	if (!company) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const request = event.request;

	try {
		const { license_plate, seats, wheelchair_capacity, bike_capacity, storage_space } =
			await request.json();
		await db
			.insertInto('vehicle')
			.values({
				license_plate,
				company,
				seats,
				wheelchair_capacity,
				bike_capacity,
				storage_space
			})
			.execute();
	} catch (e) {
		// @ts-expect-error: 'e' is of type 'unknown'
		if (e.constraint == 'vehicle_license_plate_key') {
			error(400, {
				message: 'license plate already used'
			});
		}
		error(500, {
			message: 'An unknown error occurred'
		});
	}
	return json({});
};

export const GET = async (event) => {
	const company = event.locals.user?.company;
	if (!company) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const url = event.url;
	// const localDateParam = url.searchParams.get('id');

	return json([{ id: 1, plate: 'GR-TU-41' }, { id: 2, plate: 'GR-TU-42' }]);
}
