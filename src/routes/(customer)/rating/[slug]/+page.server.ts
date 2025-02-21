import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';
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
		journey: JSON.parse(journey.json) as Itinerary,
		rated: !!journey.rating,
		id: params.slug
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.session!.userId!;
		const formData = await request.formData();

		const journeyId = readInt(formData.get('id'));
		const ratingStr = formData.get('rating');
		const comment = formData.get('comment');

		if (
			isNaN(journeyId) ||
			typeof ratingStr !== 'string' ||
			(ratingStr != 'good' && ratingStr != 'bad') ||
			typeof comment !== 'string'
		) {
			throw 'bad request';
		}

		const rating = ratingStr === 'good' ? 1 : 0;
		await db
			.updateTable('journey')
			.set({ comment, rating })
			.where('id', '=', journeyId)
			.where('user', '=', user)
			.execute();

		return { msg: msg('feedbackThank') };
	}
};
