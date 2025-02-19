import { db } from '$lib/server/db';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';

export const POST = async (event: RequestEvent) => {
	const company = event.locals.session!.companyId;
	const p = await event.request.json();
	if (!company || !p.tourId || p.message == null || p.message == undefined) {
		return json({});
	}
	await sql`CALL cancel_tour(${p.tourId}, ${company}, ${p.message})`.execute(db);
	return json({});
};
