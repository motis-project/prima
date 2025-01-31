import type { PageServerLoad } from './$types.js';
import { getTours } from '$lib/server/db/getTours.js';

export const load: PageServerLoad = async (event) => {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'not allowed';
	}
	return { tours: await getTours(companyId) };
};
