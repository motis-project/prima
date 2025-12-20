import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { addRideShareTour } from '$lib/server/booking/index';
import { msg } from '$lib/msg';
import { readFloat, readInt } from '$lib/server/util/readForm';

export const load: PageServerLoad = async ({ locals }) => {
	const vehicles = await db
		.selectFrom('rideShareVehicle')
		.where('owner', '=', locals.session!.userId!)
		.select(['rideShareVehicle.id', 'licensePlate', 'passengers', 'luggage'])
		.execute();
	return { vehicles };
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
			return fail(400, { msg: msg('unknownError') });
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
