import { json } from '@sveltejs/kit';
import { db } from '$lib/database';

export async function GET({ url }) {
	const id = Number(url.searchParams.get('id')!);
	const companies = await db.selectFrom('company').where('id', '=', id).selectAll().execute();
	return json(companies[0]);
}
