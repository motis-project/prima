import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const tourId = readInt(url.searchParams.get('tourId'));
	const fare = readInt(url.searchParams.get('fare'));

	if (isNaN(tourId)) {
		console.log(
			'API DRIVER FARE: Invalid Tour ID'
		);
		error(400, { message: 'Invalid Tour ID' });
	}

	if (isNaN(fare)) {
		console.log(
			'API DRIVER FARE:',
			'Invalid fare parameter',
			{ tourId }
		);
		error(400, { message: 'Invalid fare parameter' });
	}

	const result = await db
		.updateTable('tour')
		.set({ fare: fare })
		.where('id', '=', tourId)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		console.log(
			'API DRIVER FARE:',
			'Tour ID not found',
			{ tourId },
			{ fare }
		);
		error(404, { message: 'Tour ID not found' });
	}

	return new Response(null, { status: 204 });
};
