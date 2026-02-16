import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat, readInt } from '$lib/server/util/readForm';
import type { CalibrationItinerary } from '$lib/calibration.js';
import { areasGeoJSON, rideshareGeoJSON } from '$lib/util/geoJSON.js';

export const load: PageServerLoad = async () => {
	const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
	const calibrationSetsJson = await db.selectFrom('calibrationSets').selectAll().execute();
	const calibrationSets = Array<{
		id: number;
		name: string;
		itineraries: Array<CalibrationItinerary>;
	}>();
	for (const c of calibrationSetsJson) {
		calibrationSets.push({
			id: c.id,
			name: c.name,
			itineraries: JSON.parse(c.itinerariesJson) as Array<CalibrationItinerary>
		});
	}
	return {
		filterSettings,
		calibrationSets,
		areas: (await areasGeoJSON()).rows[0],
		rideSharingBounds: (await rideshareGeoJSON()).rows[0]
	};
};

export const actions = {
	apply: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return fail(403);
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
	save: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return fail(403);
		}

		const formData = await request.formData();
		const id = readInt(formData.get('id'));
		const updateName = formData.get('name');
		const updateJson = formData.get('itineraries');
		if (typeof updateName !== 'string' || typeof updateJson !== 'string') {
			return fail(400);
		}

		await db
			.updateTable('calibrationSets')
			.set({ name: updateName, itinerariesJson: updateJson })
			.where('id', '=', id)
			.execute();
	},
	delete: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return fail(403);
		}

		const formData = await request.formData();
		const id = readInt(formData.get('id'));

		await db.deleteFrom('calibrationSets').where('calibrationSets.id', '=', id).execute();
	}
};
