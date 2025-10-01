import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { msg, type Msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { cancelRequest } from '$lib/server/db/cancelRequest';
import { getRideshareToursAsItinerary } from '$lib/server/booking/index';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await getRideshareToursAsItinerary(locals.session!.userId!, parseInt(params.slug));

	if (result.journeys.length != 1) {
		error(404, 'Not found');
	}

	return result.journeys[0];
};

export const actions = {
	cancel: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		await cancelRequest(requestId, locals.session!.userId!);
		return { msg: msg('requestCancelled', 'success') };
	},
	remove: async ({ request, locals }) => {
		const formData = await request.formData();
		const journeyId = readInt(formData.get('journeyId'));
		await db
			.deleteFrom('journey')
			.where('journey.id', '=', journeyId)
			.where('user', '=', locals.session!.userId!)
			.execute();
		return redirect(302, `/bookings`);
	}
};
