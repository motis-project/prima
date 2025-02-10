import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { json } from '@sveltejs/kit';

export const POST = async ({ url }) => {
	const requestId = readInt(url.searchParams.get('requestId'));
	const ticketCode = url.searchParams.get('ticketCode');

	if (typeof ticketCode !== 'string' || isNaN(requestId)) {
		throw 'bad params';
	}

	const result = await db
		.updateTable('request')
		.set({ ticketChecked: true })
		.where('id', '=', requestId)
		.where('ticketCode', '=', ticketCode)
		.executeTakeFirst();

	return json({ success: result.numChangedRows !== BigInt(0) });
};
