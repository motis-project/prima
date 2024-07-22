import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/signup');
	}
	if (!event.locals.user.is_maintainer) {
		return error(403, 'Sie haben nicht die benötigte Berechtigung um diese Seite zu sehen.');
	}
};
