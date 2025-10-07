import { readInt } from '$lib/server/util/readForm';
import { LICENSE_PLATE_REGEX } from '$lib/constants';
import { createRideShareVehicle } from '$lib/server/booking';
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions } from './$types';
import { msg } from '$lib/msg';
import { replacePhoto } from '$lib/server/util/uploadPhoto';

export const actions: Actions = {
	addVehicle: async function (event: RequestEvent) {
		const user = event.locals.session?.userId;
		if (!user) {
			throw 'user not defined';
		}

		const formData = await event.request.formData();
		const licensePlate = formData.get('licensePlate');
		const color = formData.get('color');
		const hasColorString = formData.get('hasColorString');
		const model = formData.get('model');
		const hasModelString = formData.get('hasModelString');
		const smokingAllowedString = formData.get('smokingAllowed');
		const luggage = readInt(formData.get('luggage'));
		const passengers = readInt(formData.get('passengers'));
		const vehiclePicture = formData.get('vehiclePicture');

		if (passengers !== 1 && passengers !== 2 && passengers !== 3 && passengers !== 4) {
			return fail(400, { msg: msg('invalidSeats') });
		}

		if (typeof licensePlate !== 'string' || !LICENSE_PLATE_REGEX.test(licensePlate)) {
			return fail(400, { msg: msg('invalidLicensePlate') });
		}

		if (typeof color !== 'string') {
			return fail(400);
		}

		if (typeof model !== 'string') {
			return fail(400);
		}

		if (smokingAllowedString !== null && typeof smokingAllowedString !== 'string') {
			return fail(400);
		}

		if (typeof hasColorString !== 'string') {
			return fail(400);
		}

		if (typeof hasModelString !== 'string') {
			return fail(400);
		}
		const smokingAllowed = smokingAllowedString === '1';
		const hasColor = hasColorString === '1';
		const hasModel = hasModelString === '1';

		if (isNaN(luggage) || luggage <= 0 || luggage >= 11) {
			return fail(400, { msg: msg('invalidStorage') });
		}

		let vehiclePicturePath: string | null = null;
		if (vehiclePicture !== null) {
			const uploadResult = await replacePhoto(
				user,
				vehiclePicture,
				'/uploads/vehicle_pictures',
				null
			);
			if (uploadResult !== null) {
				if (typeof uploadResult !== 'string') {
					return uploadResult;
				}
				vehiclePicturePath = uploadResult;
			}
		}
		console.log(
			'created ride share vehicle',
			await createRideShareVehicle(
				user,
				luggage,
				passengers,
				hasColor ? color : null,
				hasModel ? model : null,
				smokingAllowed,
				licensePlate,
				vehiclePicturePath
			)
		);
		return redirect(302, '/account/settings');
	}
};
