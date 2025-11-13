import { createRideShareVehicle } from '$lib/server/booking';
import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions } from './$types';
import { msg } from '$lib/msg';
import { prepareVehicleUAddOrpdate } from './prepareVehicleData';

export const actions: Actions = {
	addVehicle: async function (event: RequestEvent) {
		const user = event.locals.session?.userId;
		if (!user) {
			throw 'user not defined';
		}

		const formData = await event.request.formData();
		const data = await prepareVehicleUAddOrpdate(formData, user);
		if (!('luggage' in data)) {
			return data;
		}
		try {
			console.log(
				'created ride share vehicle',
				await createRideShareVehicle(
					user,
					data.luggage,
					data.passengers,
					data.color,
					data.model,
					data.smokingAllowed,
					data.licensePlate,
					data.vehiclePicturePath
				)
			);

			return {
				success: true,
				msg: msg('vehicleAddedSuccessfully', 'success')
			};
		} catch (e) {
			return fail(400, {
				/* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
				msg: msg((<any>e).constraint ? 'duplicateLicensePlate' : 'unknownError')
			});
		}
	}
};
