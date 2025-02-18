import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';

export const POST = async (event: RequestEvent) => {
	const taxiOwner = event.locals.session!.userId!;
	const p = await event.request.json();
	console.log('taxiOwner: ', taxiOwner);
	if (!taxiOwner || !p.tourId || p.message == null || p.message == undefined) {
		return json({});
	}
	await sql`CALL cancel_tour(${p.tourId}, ${taxiOwner}, ${p.message})`.execute(db);
	return json({});
};
