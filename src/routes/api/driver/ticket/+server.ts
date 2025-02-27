import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const requestId = readInt(url.searchParams.get('requestId'));
	const ticketCode = url.searchParams.get('ticketCode');

	if (typeof ticketCode !== 'string' || isNaN(requestId)) {
		throw error(400, 'Bad request');
	}

	const result = await db
		.updateTable('request')
		.set({ ticketChecked: true })
		.where('id', '=', requestId)
		.where('ticketCode', '=', ticketCode)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		throw error(404, 'Not found');
	}

	return new Response(null, { status: 204 });
};
