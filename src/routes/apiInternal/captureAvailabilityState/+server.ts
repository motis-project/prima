import { captureAvailabilityState } from '$lib/server/availabilityCompensation/availabilityCompensation';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	await captureAvailabilityState();
	return json({});
};
