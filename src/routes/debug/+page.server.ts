import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
	return { companies: await db.selectFrom('company').select(['id', 'lat', 'lng']).execute() };
};
