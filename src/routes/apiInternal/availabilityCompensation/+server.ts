import { computeCompensation } from '$lib/server/availabilityCompensation/availabilityCompensation';

import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	const now = new Date(Date.now());
	const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0).getTime();
	await computeCompensation(startOfMonth);
	return json({});
};
