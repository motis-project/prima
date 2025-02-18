import { db } from '$lib/server/db';
import { json, type RequestEvent } from '@sveltejs/kit';
import { sql } from 'kysely';

export const POST = async (event: RequestEvent) => {
	const taxiOwner = event.locals.session!.userId!;
	const p = await event.request.json();
	if (!taxiOwner || !p.tourId || p.message == null || p.message == undefined) {
		return json({});
	}
	const m = 'eklrjhnl';
	await sql`CALL cancel_tour(${p.tourId}, ${taxiOwner}, ${m})`.execute(db);
	return json({});
};
