import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';
import { cancelRequest } from '$lib/server/db/cancel';
import { msg, type Msg } from '$lib/msg';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.select(['json', 'request.ticketCode', 'request.customer', 'request.id as requestId'])
		.where('journey.id', '=', parseInt(params.slug))
		.where('user', '=', locals.session!.userId!)
		.executeTakeFirst();

	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		journey: JSON.parse(journey.json) as Itinerary,
		ticketCode: journey.ticketCode,
		requestId:journey.requestId,
		customerId: journey.customer
	};
};

export const actions = {
	default: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const user = locals.session?.userId;
		const formData = await request.formData();
		const customer: number = formData.get('customerId');
		if (!user || user != customer) {
			return { msg: msg('accountDoesNotExist') };
		}
		const requestId: number = formData.get('requestId');
		cancelRequest(requestId);
		return { msg: msg('requestCancelled') };
	}
};