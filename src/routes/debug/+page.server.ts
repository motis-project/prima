import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { readFloat } from '$lib/server/util/readForm';
import { sql } from 'kysely';
import { whitelist } from '../api/whitelist/whitelist';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { Translations } from '$lib/i18n/translation';
import { getIp } from '$lib/server/getIp';
import { error } from '@sveltejs/kit';
import { bookingApi } from '$lib/server/booking/bookingApi';

export type BookingError = { msg: keyof Translations['msg'] };

export const actions = {
	default: async (event): Promise<BookingError | { request: number }> => {
		const clientIP = getIp(event);
		if (clientIP !== '127.0.0.1' && clientIP !== '::1' && clientIP !== '::ffff:127.0.0.1') {
			return error(403);
		}
		const customer = event.locals.session?.userId;
		if (!customer) {
			throw 'not logged in';
		}

		const formData = await event.request.formData();

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

		const capacities: Capacities = {
			bikes: 0,
			luggage: 0,
			passengers: 1,
			wheelchairs: 0
		};
		const start = { lat: fromLat, lng: fromLng, address: '' };
		const target = { lat: toLat, lng: toLng, address: '' };
		const whitelistResult = await whitelist(
			{ ...target },
			[{ ...start, times: [time.getTime()] }],
			capacities,
			false
		);

		const result = whitelistResult[0][0];
		if (result == undefined) {
			return { msg: 'noVehicle' };
		}
		const connection1 = {
			start,
			target,
			startTime: result.pickupTime,
			targetTime: result.dropoffTime,
			signature: '',
			startFixed: false
		};

		const bookingResponse = await bookingApi(
			{ connection1, connection2: null, capacities },
			customer,
			true,
			0,
			0,
			0
		);

		if (bookingResponse.request1Id === undefined) {
			return { msg: 'bookingError' };
		}

		return { request: bookingResponse.request1Id };
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
