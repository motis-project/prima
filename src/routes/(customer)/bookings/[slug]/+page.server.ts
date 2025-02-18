import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.select(['json', 'request.ticketCode'])
		.where('journey.id', '=', parseInt(params.slug))
		.where('user', '=', locals.session!.userId!)
		.executeTakeFirst();

	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		journey: JSON.parse(journey.json) as Itinerary,
		ticketCode: journey.ticketCode
	};
};
