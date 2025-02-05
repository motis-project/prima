import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { readFloat } from '$lib/server/util/readForm';
import { bookRide } from '$lib/server/booking/bookRide';
import { sql } from 'kysely';
import { whitelist } from '../api/whitelist/whitelist';
import type { Capacities } from '$lib/server/booking/Capacities';
import type { Translations } from '$lib/i18n/translation';
import { insertRequest } from '../api/booking/query';

export type BookingError = { msg: keyof Translations['msg'] };

export const actions = {
	default: async ({ request, locals }): Promise<BookingError | { vehicle: number }> => {
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

		console.log('whitelistResult: ', JSON.stringify(whitelistResult, null, '\t'));

		const result = whitelistResult[0][0];
		if (result == undefined) {
			return { msg: 'noVehicle' };
		}

		const connection = {
			start,
			target,
			startTime: result.pickupTime,
			targetTime: result.dropoffTime
		};
		const booking = await bookRide(connection, capacities, true);

		console.log('booking: ', JSON.stringify(booking, null, '\t'));

		if (booking == undefined) {
			return { msg: 'noVehicle' };
		}

		await db.transaction().execute(async (trx) => {
			await insertRequest(
				booking.best,
				capacities,
				connection,
				customer,
				booking.eventGroupUpdateList,
				[...booking.mergeTourList],
				booking.pickupEventGroup,
				booking.dropoffEventGroup,
				booking.neighbourIds,
				booking.directDurations,
				trx
			);
		});

		return { vehicle: booking.best.vehicle };
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
