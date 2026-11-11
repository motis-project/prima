import { setAutomaticAvailability } from '$lib/server/setAutomaticAvailability';
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

	const { vehicleId, enabled } = await request.json();
	if (!Number.isInteger(vehicleId) || typeof enabled !== 'boolean') {
		return error(400, 'Invalid vehicle ID or enabled flag.');
	}

	const result = await setAutomaticAvailability(companyId, vehicleId, enabled);
	if (result === 'vehicleNotFound') {
		return error(404, 'Vehicle not found.');
	}
	if (result === 'lastVehicle') {
		return error(409, 'At least one vehicle must have automatic availability.');
	}

	return json({ vehicleId, enabled });
};
