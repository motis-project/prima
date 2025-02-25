import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';
import { msg, type Msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { cancelRequest } from '$lib/server/db/cancelRequest';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.innerJoin('event', 'event.request', 'request.id')
		.orderBy('event.communicatedTime', 'asc')
		.select([
			'json',
			'request.passengers',
			'request.luggage',
			'request.wheelchairs',
			'request.cancelled',
			'request.ticketCode',
			'request.customer',
			'request.id as requestId',
			'event.communicatedTime'
		])
		.where('journey.id', '=', parseInt(params.slug))
		.where('user', '=', locals.session!.userId!)
		.limit(1)
		.executeTakeFirst();

	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		...journey,
		journey: JSON.parse(journey.json) as Itinerary
	};
};

export const actions = {
	default: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		await cancelRequest(requestId, locals.session!.userId!);
		return { msg: msg('requestCancelled', 'success') };
	}
};
