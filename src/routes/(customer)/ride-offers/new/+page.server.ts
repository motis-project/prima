import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { addRideShareTour } from '$lib/server/booking/index';
import { msg } from '$lib/msg';

export const load: PageServerLoad = async ({ params, locals }) => {
	const vehicles = await db
		.selectFrom('rideShareVehicle')
		.where('owner', '=', locals.session?.userId!)
		.select(['rideShareVehicle.id', 'licensePlate', 'passengers', 'luggage'])
		.execute();
	return { vehicles };
};

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const parseCoords = (prefix: string) => {
			return {
				lat: parseFloat(formData.get(prefix + 'Lat')),
				lng: parseFloat(formData.get(prefix + 'Lon'))
			};
		};
		console.log(formData);
		// TODO transaction, address
		const tourId = await addRideShareTour(
			parseInt(formData.get('time')),
			formData.get('timeType') !== 'arrival',
			parseInt(formData.get('passengers')),
			parseInt(formData.get('luggage')),
			locals.session.userId!,
			parseInt(formData.get('vehicle')),
			parseCoords('start'),
			parseCoords('end')
		);
		console.log('weird');
		if (tourId == undefined) {
			return fail(400, { msg: msg('vehicleConflict') });
		}
		return redirect(302, `/ride-offers`);
	}
};
