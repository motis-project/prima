import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm';
import { msg } from '$lib/msg';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('journey')
		.innerJoin('request', 'journey.request1', 'request.id')
		.select(['json', 'rating'])
		.where('journey.id', '=', parseInt(params.slug))
		.where('user', '=', locals.session!.userId)
		.executeTakeFirst();

	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		journey: journey.json,
		rated: !!journey.rating,
		id: params.slug
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.session!.userId!;
		const formData = await request.formData();

		const journeyId = readInt(formData.get('id'));
		const reason = formData.get('reason');
		const ratingBookingStr = formData.get('ratingBooking');
		const ratingJourneyStr = formData.get('ratingJourney');
		const comment = formData.get('comment');

		const invalidRating = (ratingStr: FormDataEntryValue | null) =>
			typeof ratingStr !== 'string' || (ratingStr != 'good' && ratingStr != 'bad');

		const ratingToBool = (ratingStr: FormDataEntryValue | null) => (ratingStr === 'good' ? 1 : 0);

		if (
			isNaN(journeyId) ||
			typeof reason !== 'string' ||
			invalidRating(ratingBookingStr) ||
			invalidRating(ratingJourneyStr) ||
			typeof comment !== 'string'
		) {
			return fail(400, { msg: msg('feedbackMissing') });
		}

		await db
			.updateTable('journey')
			.set({
				reason,
				ratingBooking: ratingToBool(ratingBookingStr),
				rating: ratingToBool(ratingJourneyStr),
				comment
			})
			.where('id', '=', journeyId)
			.where('user', '=', user)
			.execute();

		return { msg: msg('feedbackThank', 'success') };
	}
};
