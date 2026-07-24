import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat, readInt } from '$lib/server/util/readForm';
import type { CalibrationItinerary } from '$lib/calibration.js';
import { areasGeoJSON, rideshareGeoJSON } from '$lib/util/geoJSON.js';

export const load: PageServerLoad = async () => {
	const filterSettings = await db.selectFrom('taxiFilter').selectAll().executeTakeFirst();
	const calibrationSetsJson = await db
		.selectFrom('calibrationSets')
		.selectAll()
		.orderBy('name', 'asc')
		.execute();
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
			taxiSlope: readFloat(formData.get('taxiSlope')),
			dampingWindow: readFloat(formData.get('dampingWindow'))
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
	},
	import: async ({ request, locals }) => {
		if (!locals.session?.isAdmin) {
			return fail(403);
		}

		const formData = await request.formData();
		const file = formData.get('importJson') as File;
		const str = await file.text();

		if (typeof str !== 'string') {
			return fail(400);
		}
		const json = JSON.parse(str);

		const newFilter: Record<string, number> = {
			perTransfer: json.filterSettings.perTransfer,
			taxiBase: json.filterSettings.taxiBase,
			taxiPerMinute: json.filterSettings.taxiPerMinute,
			taxiDirectPenalty: json.filterSettings.taxiDirectPenalty,
			ptSlope: json.filterSettings.ptSlope,
			taxiSlope: json.filterSettings.taxiSlope,
			dampingWindow: json.filterSettings.dampingWindow
		};
		await db.updateTable('taxiFilter').set(newFilter).execute();

		json['calibrationSets'].forEach(
			async (e: { id: number; name: string; itineraries: Array<CalibrationItinerary> }) => {
				const name = e.name;
				const itinerariesJson = JSON.stringify(e.itineraries);
				await db.insertInto('calibrationSets').values({ name, itinerariesJson }).execute();
			}
		);
	}
};
