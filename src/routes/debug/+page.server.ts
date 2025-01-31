import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/db';
import { readFloat } from '$lib/server/util/readForm.js';
import { bookRide } from '$lib/server/bookRide.js';

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

export const load: PageServerLoad = async () => {
	return { companies: await db.selectFrom('company').select(['id', 'lat', 'lng']).execute() };
};
