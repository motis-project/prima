import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { addRideShareTour } from '$lib/server/booking/index';
import { msg } from '$lib/msg';
import { readFloat, readInt } from '$lib/server/util/readForm';
import { sql } from 'kysely';

export const load: PageServerLoad = async ({ locals }) => {
	const vehicles = await db
		.selectFrom('rideShareVehicle')
		.where('owner', '=', locals.session!.userId!)
		.select(['rideShareVehicle.id', 'licensePlate', 'passengers', 'luggage'])
		.execute();
	const rideShareGeoJSON = async () => {
		return await sql`
				SELECT 'FeatureCollection' AS TYPE,
					array_to_json(array_agg(f)) AS features
				FROM
					(SELECT 'Feature' AS TYPE,
						ST_AsGeoJSON(lg.area, 15, 0)::json As geometry,
						json_build_object('id', id, 'name', name) AS properties
					FROM ride_share_zone AS lg) AS f`.execute(db);
	};
	return { vehicles, rideSharingBounds: (await rideShareGeoJSON()).rows[0] };
};

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parseCoords = (prefix: string) => {
			return {
				lat: readFloat(formData.get(prefix + 'Lat')),
				lng: readFloat(formData.get(prefix + 'Lon'))
			};
		};

		const time = readInt(formData.get('time'));
		const startFixed = formData.get('timeType') !== 'arrival';
		const passengers = readInt(formData.get('passengers'));
		const luggage = readInt(formData.get('luggage'));

		const vehicle = readInt(formData.get('vehicle'));
		const start = parseCoords('start');
		const end = parseCoords('end');
		const startLabel = formData.get('startLabel');
		const endLabel = formData.get('endLabel');

		if (
			Number.isNaN(time) ||
			Number.isNaN(passengers) ||
			Number.isNaN(luggage) ||
			Number.isNaN(vehicle) ||
			typeof startLabel !== 'string' ||
			typeof endLabel !== 'string'
		) {
			console.log(": time: " + time + ", passengers: " + passengers + ", luggage: " + luggage + ", vehicle: " + vehicle + ", startLabel: " + startLabel + ", endLabel: " + endLabel);
			return fail(400, { msg: msg('unknownError')});
		}

		// TODO transaction
		const tourId = await addRideShareTour(
			time,
			startFixed,
			passengers,
			luggage,
			locals.session!.userId!,
			vehicle,
			start,
			end,
			startLabel,
			endLabel
		);
		if (tourId == undefined) {
			return fail(400, { msg: msg('vehicleConflict') });
		}
		return redirect(302, `/ride-offers`);
	}
};
