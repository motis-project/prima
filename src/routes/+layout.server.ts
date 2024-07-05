import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (event.route.id !== '/signup' && !event.locals.user) {
		return redirect(302, '/signup');
	}
	return {
		user: event.locals.user
	};
};
