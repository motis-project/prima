import type { PageServerLoad, RequestEvent } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat } from '$lib/server/util/readForm';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
	const calibrationItineraries = await db
		.selectFrom('calibrationItineraries')
		.selectAll()
		.execute();
	return {
		filterSettings,
		calibrationItineraries
	};
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const updateData: Record<string, number> = {
			perTransfer: readFloat(formData.get('perTransfer')),
			taxiBase: readFloat(formData.get('taxiBase')),
			taxiPerMinute: readFloat(formData.get('taxiPerMinute')),
			taxiDirectPenalty: readFloat(formData.get('taxiDirectPenalty')),
			ptSlope: readFloat(formData.get('ptSlope')),
			taxiSlope: readFloat(formData.get('taxiSlope'))
		};

		await db.updateTable('taxiFilter').set(updateData).execute();
	}
};
