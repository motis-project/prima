import { db } from '$lib/server/db';
import { json, type RequestEvent } from '@sveltejs/kit';
import { sql } from 'kysely';

export const POST = async (event: RequestEvent) => {
	const customer = event.locals.session!.userId!;
	const p = await event.request.json();
	if (!customer || !p.requestId) {
		return json({});
	}
	await sql`CALL cancel_request(${p.requestId}, ${customer})`.execute(db);
	return json({});
};
