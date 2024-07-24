import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	if (event.locals.user.is_maintainer) {
		return redirect(302, '/activation');
	}
	if (event.locals.user.is_entrepreneur) {
		return redirect(302, '/company');
	}
	return {
		user: event.locals.user
	};
};
