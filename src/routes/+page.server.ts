import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		console.log("redirect guest to login");
		return redirect(302, '/login');
	}
	if (event.locals.user.is_maintainer) {
		console.log("redirect maintainer to /activation");
		return redirect(302, '/maintainer/activation');
	}
	if (event.locals.user.is_entrepreneur) {
		console.log("redirect entrepreneur to /company");
		return redirect(302, '/user/company');
	}
	return {
		user: event.locals.user
	};
};
