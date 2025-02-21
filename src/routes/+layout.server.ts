import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const pendingRating =
		locals.session && !url.pathname.startsWith('/rating')
			? await db
					.selectFrom('journey')
					.innerJoin('event', 'journey.request1', 'event.request')
					.where('journey.rating', 'is', null)
					.where('journey.user', '=', locals.session.userId)
					// .where('event.communicatedTime', '<=', Date.now())
					.orderBy('event.communicatedTime desc')
					.select('journey.id')
					.limit(1)
					.executeTakeFirst()
			: undefined;

	return {
		pendingRating,
		isLoggedIn: !!locals.session,
		isAdmin: locals.session?.isAdmin,
		isTaxiOwner: locals.session?.isTaxiOwner
	};
};
