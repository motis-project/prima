import { db } from '$lib/server/db';
import { json } from '@sveltejs/kit';

export const GET = async ({ locals }) => {
	const companyId = locals.session!.companyId!;
	const vehicles = await db
		.selectFrom('vehicle')
		.where('company', '=', companyId)
		.selectAll()
		.execute();
	return json(vehicles);
};
