import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { msg, type Msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { acceptRideShareRequest, getRideshareToursAsItinerary } from '$lib/server/booking/index';
import { cancelRideShareTour } from '$lib/server/booking/rideShare/cancelRideShareTour';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await getRideshareToursAsItinerary(
		locals.session!.userId!,
		parseInt(params.slug),
		true
	);

	if (result.journeys.length != 1) {
		error(404, 'Not found');
	}

	return result.journeys[0];
};

export const actions = {
	cancel: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		await cancelRideShareTour(requestId, locals.session!.userId!);
		return redirect(302, `/bookings`);
	},
	accept: async ({ request, locals }) => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		const result = await acceptRideShareRequest(requestId, locals.session!.userId!);
		if (result.status != 200) {
			return fail(result.status, { msg: msg('unknownError') });
		}
	}
};
