import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { error } from '@sveltejs/kit';

export const PUT = async ({ url }) => {
	const requestId = readInt(url.searchParams.get('requestId'));
	const ticketCode = url.searchParams.get('ticketCode');

	if (isNaN(requestId)) {
		console.log('API DRIVER TICKET:', 'Invalid request ID');
		error(400, { message: 'Invalid request ID' });
	}

	if (typeof ticketCode !== 'string') {
		console.log('API DRIVER TICKET:', 'Invalid ticketCode', { requestId });
		error(400, { message: 'Invalid ticket code' });
	}

	const result = await db
		.updateTable('request')
		.set({ ticketChecked: true })
		.where('id', '=', requestId)
		.where('ticketCode', '=', ticketCode)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		console.log(
			'API DRIVER TICKET:',
			'Request ID not found or invalid ticket code',
			{ requestId },
			{ ticketCode }
		);
		error(404, { message: 'Request ID not found or invalid ticket code' });
	}

	return new Response(null, { status: 204 });
};
