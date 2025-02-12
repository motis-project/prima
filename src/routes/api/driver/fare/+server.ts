import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { json } from '@sveltejs/kit';

export const POST = async ({ url }) => {
	const tourId = readInt(url.searchParams.get('tourId'));
	const fare = readInt(url.searchParams.get('fare'));

	if (isNaN(fare) || isNaN(tourId)) {
		throw 'bad params';
	}

	await db.updateTable('tour').set({ fare: fare }).where('id', '=', tourId).execute();

	return json({ success: true });
};
