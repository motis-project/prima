import type { PageServerLoad } from './$types.js';
import { db } from '$lib/database';

export const load: PageServerLoad = async () => {
	const companies = await db
		.selectFrom('company')
		.select(['id', 'latitude', 'longitude'])
		.execute();
	return {
		companies
	};
};
