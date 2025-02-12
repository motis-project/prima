import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		isLoggedIn: !!locals.session,
		isAdmin: locals.session?.isAdmin,
		isTaxiOwner: locals.session?.isTaxiOwner
	};
};
