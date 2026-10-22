import { db } from '$lib/server/db';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	const isAdmin = locals.session?.isAdmin;
	if (companyId === undefined || companyId === null) {
		return error(403, 'A company account is required.');
	}

	if (isAdmin) {
		return error(403);
	}

	const { vehicleId } = await request.json();
	if (!Number.isInteger(vehicleId)) {
		return error(400, 'Invalid vehicle ID.');
	}

	const vehicle = await db
		.selectFrom('vehicle')
		.select('vehicle.id')
		.where('vehicle.id', '=', vehicleId)
		.where('vehicle.company', '=', companyId)
		.executeTakeFirst();

	if (vehicle === undefined) {
		return error(404, 'Vehicle not found.');
	}

	await db
		.updateTable('vehicle')
		.set((eb) => ({
			setAutomaticAvailability: eb
				.case()
				.when('vehicle.id', '=', vehicleId)
				.then(true)
				.else(false)
				.end()
		}))
		.where('vehicle.company', '=', companyId)
		.execute();

	return json({ vehicleId });
};
