import { json } from '@sveltejs/kit';
import { db } from '$lib/database';

export const POST = async ({ request }) => {
	const { license_plate, company, seats, wheelchair_capacity, bike_capacity, storage_space } =
		await request.json();
	await db
		.insertInto('vehicle')
		.values({
			license_plate: license_plate,
			company: Number(company),
			seats: Number(seats),
			wheelchair_capacity: Number(wheelchair_capacity),
			bike_capacity: Number(bike_capacity),
			storage_space: Number(storage_space)
		})
		.execute();
	return json({});
};
