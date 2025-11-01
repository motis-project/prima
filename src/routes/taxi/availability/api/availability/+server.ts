import { json } from '@sveltejs/kit';
import { addAvailability } from '$lib/server/addAvailability';
import { deleteAvailability } from '$lib/server/deleteAvailability.js';

export const DELETE = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'not allowed';
	}
	const { vehicleId, from, to } = await request.json();
	if (typeof vehicleId !== 'number' || typeof from !== 'number' || typeof to !== 'number') {
		console.log('remove availability invalid params: ', { vehicleId, from, to });
		throw 'invalid params';
	}
	await deleteAvailability(from, to, vehicleId, companyId);
	return json({});
};

export const POST = async ({ locals, request }) => {
	const companyId = locals.session?.companyId;
	if (!companyId) {
		throw 'no company';
	}
	const { vehicleId, from, to } = await request.json();
	if (typeof vehicleId !== 'number' || typeof from !== 'number' || typeof to !== 'number') {
		console.log('add availability invalid params: ', { vehicleId, from, to });
		throw 'invalid params';
	}
	await addAvailability(from, to, companyId, vehicleId);
	return json({});
};
