import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const requestId = readInt(url.searchParams.get('requestId'));
	const ticketCode = url.searchParams.get('ticketCode');

	if (typeof ticketCode !== 'string' || isNaN(requestId)) {
		console.log(
			'Invalid ticketCode parameter in api/driver/ticket.',
			{ requestId },
			{ ticketCode }
		);
		error(400, { message: 'Invalid ticketCode parameter' });
	}

	const result = await db
		.updateTable('request')
		.set({ ticketChecked: true })
		.where('id', '=', requestId)
		.where('ticketCode', '=', ticketCode)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		error(404, { message: 'Request not found or invalid ticket code' });
	}

	return new Response(null, { status: 204 });
};
