import { json } from '@sveltejs/kit';
import { db } from '$lib/database';

export async function GET({ url }) {
	const id = Number(url.searchParams.get('company')!);
	const vehicles = await db.selectFrom('vehicle').where('company', '=', id).selectAll().execute();
	return json(vehicles);
}
