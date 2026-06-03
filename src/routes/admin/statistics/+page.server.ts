import { viewStatistics } from '$lib/getStatistics';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session?.isAdmin) {
		error(403, 'Admin privileges required');
	}

	return await viewStatistics();
};
