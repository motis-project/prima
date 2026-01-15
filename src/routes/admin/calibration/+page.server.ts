import type { PageServerLoad, RequestEvent } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat, readInt } from '$lib/server/util/readForm';

export const load: PageServerLoad = async (event: RequestEvent) => {
	const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
	const calibrationSets = await db.selectFrom('calibrationSets').selectAll().execute();
	return {
		filterSettings,
		calibrationSets
	};
};

export const actions = {
	applyParams: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return;
		}

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
	},
	deleteCalibrationSet: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return;
		}

		const formData = await request.formData();
		const id = readInt(formData.get('id'));

		await db.deleteFrom('calibrationSets').where('calibrationSets.id', '=', id).execute();
	}
};
