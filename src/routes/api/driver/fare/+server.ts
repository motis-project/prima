import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const tourId = readInt(url.searchParams.get('tourId'));
	const fare = readInt(url.searchParams.get('fare'));

	if (isNaN(fare) || isNaN(tourId)) {
		console.log('Invalid fare or tourId parameter in api/driver/fare.', { tourId }, { fare });
		error(400, { message: 'Invalid fare or tourId parameter' });
	}

	const result = await db
		.updateTable('tour')
		.set({ fare: fare })
		.where('id', '=', tourId)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		error(404, { message: 'Tour not found' });
	}

	return new Response(null, { status: 204 });
};
