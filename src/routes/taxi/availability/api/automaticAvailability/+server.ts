import { db } from '$lib/server/db';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (companyId === undefined || companyId === null) {
		error(403, 'A company account is required.');
	}

	const { vehicleId, setAutomaticAvailability } = await request.json();
	if (!Number.isInteger(vehicleId) || typeof setAutomaticAvailability !== 'boolean') {
		error(400, 'Invalid vehicle ID or automatic availability value.');
	}

	const result = await db
		.updateTable('vehicle')
		.set({ setAutomaticAvailability })
		.where('vehicle.id', '=', vehicleId)
		.where('vehicle.company', '=', companyId)
		.$if(!setAutomaticAvailability, (qb) =>
			qb.where((eb) =>
				eb.exists((eb) =>
					eb
						.selectFrom('vehicle')
						.where('vehicle.company', '=', companyId)
						.where('vehicle.id', '!=', vehicleId)
						.where('vehicle.setAutomaticAvailability', '=', true)
				)
			)
		)
		.executeTakeFirst();

	if (result.numUpdatedRows === 0n) {
		error(404, 'Vehicle not found.');
	}

	return json({ setAutomaticAvailability });
};
