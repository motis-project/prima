import type { PageServerLoad, RequestEvent } from './$types.js';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async (event: RequestEvent) => {
	let filterSettings = await db.selectFrom('taxiFilter').selectAll().execute();
	return {
		filterSettings
	};
};
