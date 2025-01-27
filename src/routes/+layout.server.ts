import type { PageServerLoadEvent } from './$types';

export function load(event: PageServerLoadEvent) {
	return {
		isAdmin: event.locals.session?.isAdmin,
		isTaxiOwner: event.locals.session?.isTaxiOwner
	};
}
