import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		isAdmin: locals.session?.isAdmin,
		isTaxiOwner: locals.session?.isTaxiOwner
	};
};
