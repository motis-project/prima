import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';

export const PUT = async ({ url }) => {
	const tourId = readInt(url.searchParams.get('tourId'));
	const fare = readInt(url.searchParams.get('fare'));

	if (isNaN(fare) || isNaN(tourId)) {
		return new Response(null, { status: 400 });
	}

	const result = await db
		.updateTable('tour')
		.set({ fare: fare })
		.where('id', '=', tourId)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		return new Response(null, { status: 404 });
	}

	return new Response(null, { status: 204 });
};
