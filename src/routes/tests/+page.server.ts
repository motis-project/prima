import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'kysely';
import type { Translations } from '$lib/i18n/translation';
import fs from 'fs';
import path from 'path';
import type { Actions, RequestEvent } from './$types';

export type BookingError = { msg: keyof Translations['msg'] };

export const load: PageServerLoad = async (event: RequestEvent) => {
	const url = event.url;
	let test = url.searchParams.get('test');
	if (test) {
		const testFilePath = path.resolve('src/lib/server/booking/taxi/tests/generatedTests/testJsons.ts');

		let fileContent: string;
		try {
			fileContent = fs.readFileSync(testFilePath, 'utf-8');
		} catch (err) {
			console.error('Could not read test file', err);
			return {
				test: null,
				error: 'Could not read test file',
				companies: [],
				areas: {}
			};
		}

		const searchIndex = fileContent.indexOf(test);
		if (searchIndex !== -1) {
			const before = fileContent.slice(0, searchIndex);
			const after = fileContent.slice(searchIndex);

			const startIndex = before.lastIndexOf('// startoftest');
			const endIndex = after.indexOf('// endoftest');

			if (startIndex !== -1 && endIndex !== -1) {
				const start = startIndex + '// startoftest'.length;
				const end = searchIndex + endIndex;
				const extracted = fileContent.slice(start, end).trim();

				test = extracted;
			} else {
				console.warn('Could not find startoftest or endoftest around test ID');
			}
		} else {
			console.warn('Test ID not found in file');
		}
	}
	return {
		test,
		companies: await db.selectFrom('company').select(['id', 'lat', 'lng']).execute(),
		areas: (await areasGeoJSON()).rows[0]
	};
};

export const actions: Actions = {
	addTest: async ({ request }) => {
		const formData = await request.formData();
		const raw = formData.get('value');

		if (typeof raw !== 'string') {
			console.log('Invalid value');
			return { success: false, error: 'Invalid value' };
		}

		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch (_) {
			console.log('Invalid JSON input', { raw });
			return { success: false, error: 'Invalid JSON input' };
		}
		const formatted = JSON.stringify(parsed, null, 2);

		const testFilePath = path.resolve('src/lib/server/booking/tests/generatedTests/testJsons.ts');
		const marker = '// printhere';

		let fileContent: string;
		try {
			fileContent = fs.readFileSync(testFilePath, 'utf-8');
		} catch (_) {
			console.log('Could not read file');
			return { success: false, error: 'Could not read file' };
		}

		const index = fileContent.indexOf(marker);
		if (index === -1) {
			console.log('Marker not found');
			return { success: false, error: 'Marker not found' };
		}

		const before = fileContent.slice(0, index + marker.length);
		const after = fileContent.slice(index + marker.length);

		const indentedFormatted = formatted
			.split('\n')
			.map((line) => '\t' + line)
			.join('\n');
		console.log({ indentedFormatted });
		const newContent = `${before}\n// startoftest\n\t${indentedFormatted},\n// endoftest\n${after}`;

		try {
			fs.writeFileSync(testFilePath, newContent, 'utf-8');
		} catch (_) {
			console.log('Failed to write to file');
			return { success: false, error: 'Failed to write to file' };
		}

		return { success: true };
	}
};

const areasGeoJSON = async () => {
	return await sql`
        SELECT 'FeatureCollection' AS TYPE,
            array_to_json(array_agg(f)) AS features
        FROM
            (SELECT 'Feature' AS TYPE,
                ST_AsGeoJSON(lg.area, 15, 0)::json As geometry,
                json_build_object('id', id, 'name', name) AS properties
            FROM zone AS lg) AS f`.execute(db);
};
