import {
	computeCompensation,
	getStartOfMonth
} from '$lib/server/availabilityCompensation/availabilityCompensation';

import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	const now = new Date(Date.now());
	const startOfMonth = getStartOfMonth(new Date(now.getTime()));
	await computeCompensation(startOfMonth, true);
	return json({});
};
