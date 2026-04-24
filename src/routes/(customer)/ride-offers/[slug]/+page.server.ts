import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { msg, type Msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { acceptRideShareRequest, getRideshareToursAsItinerary } from '$lib/server/booking/index';
import { cancelRideShareTour } from '$lib/server/booking/rideShare/cancelRideShareTour';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async ({ params, locals }) => {
	const result = await getRideshareToursAsItinerary(
		locals.session!.userId!,
		parseInt(params.slug),
		true
	);

	if (result.journeys.length != 1) {
		error(404, 'Not found');
	}
	const pattern =
		(await db
			.selectFrom('repeatPattern')
			.selectAll()
			.where('id', '=', result.journeys[0].pattern)
			.executeTakeFirst()) ?? null;
	const days = Array.from({ length: 7 }, () => false);
	if (pattern) {
		for (let i = 0; i != 7; ++i) {
			if (pattern.days & (1 << i)) {
				days[i] = true;
			}
		}
	}
	return {
		...result.journeys[0],
		days,
		rangeStart: pattern?.rangeStart,
		rangeEnd: pattern?.rangeEnd
	};
};

export const actions = {
	cancel: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		const patternString = formData.get('pattern');
		if (typeof patternString !== 'string' || patternString === null) {
			throw new Error();
		}
		let pattern: number | undefined = undefined;
		if (patternString) {
			pattern = parseInt(patternString);
		}
		if (Number.isNaN(pattern)) {
			throw new Error();
		}
		await cancelRideShareTour(requestId, locals.session!.userId!, pattern);
		return redirect(302, `/bookings`);
	},
	accept: async ({ request, locals }) => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		const result = await acceptRideShareRequest(requestId, locals.session!.userId!);
		if (result.status != 200) {
			return fail(result.status, { msg: msg('rideShareAcceptError') });
		}
	}
};
