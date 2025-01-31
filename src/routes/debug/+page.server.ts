import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat } from '$lib/server/util/readForm.js';
import { bookRide } from '$lib/server/bookRide.js';
import { sql } from 'kysely';

export const actions = {
	default: async ({ request, locals }) => {
		const customer = locals.session?.userId;
		if (!customer) {
			throw 'not logged in';
		}

		const formData = await request.formData();

		const fromLat = readFloat(formData.get('fromLat'));
		const fromLng = readFloat(formData.get('fromLng'));
		const toLat = readFloat(formData.get('toLat'));
		const toLng = readFloat(formData.get('toLng'));
		const timeStr = formData.get('time');

		if (
			isNaN(fromLat) ||
			isNaN(fromLng) ||
			isNaN(toLat) ||
			isNaN(toLng) ||
			typeof timeStr !== 'string'
		) {
			console.log('invalid booking params', { fromLat, fromLng, toLat, toLng, timeStr });
			throw 'invalid booking params';
		}

		const time = new Date(timeStr);
		if (isNaN(time.getTime())) {
			console.log('invalid time', timeStr);
			throw 'invalid time';
		}

		return await bookRide({
			customer,
			from: { lat: fromLat, lng: fromLng, address: '' },
			to: { lat: toLat, lng: toLng, address: '' },
			startFixed: true,
			time: time.getTime(),
			nPassengers: 1,
			nWheelchairs: 0,
			nBikes: 0,
			nLuggage: 0
		});
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

export const load: PageServerLoad = async () => {
	return {
		companies: await db.selectFrom('company').select(['id', 'lat', 'lng']).execute(),
		areas: (await areasGeoJSON()).rows[0]
	};
};
