import { createStatistics } from '$lib/createStatistics';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	await createStatistics();
	return json({});
};
