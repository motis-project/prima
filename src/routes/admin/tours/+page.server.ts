import type { PageServerLoad } from './$types.js';
import { getTours } from '$lib/server/db/getTours.js';

export const load: PageServerLoad = async () => {
	return { tours: await getTours() };
};
