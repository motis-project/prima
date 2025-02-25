import type { PageServerLoad } from './$types.js';
import { getTours } from '$lib/server/db/getTours.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const tourId = parseInt(url.searchParams.get('tourId') ?? '0');
	return {
		tours: await getTours(true, companyId),
		tourId: !tourId ? undefined : tourId
	};
};
