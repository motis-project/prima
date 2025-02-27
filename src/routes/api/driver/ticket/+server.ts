import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';

export const PUT = async ({ url }) => {
	const requestId = readInt(url.searchParams.get('requestId'));
	const ticketCode = url.searchParams.get('ticketCode');

	if (typeof ticketCode !== 'string' || isNaN(requestId)) {
		return new Response(null, { status: 400 });
	}

	const result = await db
		.updateTable('request')
		.set({ ticketChecked: true })
		.where('id', '=', requestId)
		.where('ticketCode', '=', ticketCode)
		.executeTakeFirst();

	if (result.numUpdatedRows === BigInt(0)) {
		return new Response(null, { status: 404 });
	}

	return new Response(null, { status: 204 });
};
