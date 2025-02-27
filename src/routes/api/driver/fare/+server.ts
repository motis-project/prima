import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const tourId = readInt(url.searchParams.get('tourId'));
	const fare = readInt(url.searchParams.get('fare'));

	if (isNaN(fare) || isNaN(tourId)) {
		throw error(400, 'Bad request');
	}

	const result = await db
		.updateTable('tour')
		.set({ fare: fare })
		.where('id', '=', tourId)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		throw error(404, 'Not found');
	}

	return new Response(null, { status: 204 });
};
