import { db } from '$lib/database';

export async function load() {
	const vehicles = await db.selectFrom('vehicle').where('company', '=', 1).selectAll().execute();
	return {
		vehicles
	};
}
