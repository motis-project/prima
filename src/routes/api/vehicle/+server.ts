import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';

export const POST = async (event) => {
	const company = event.locals.user!.company!;
	const request = event.request;;

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
