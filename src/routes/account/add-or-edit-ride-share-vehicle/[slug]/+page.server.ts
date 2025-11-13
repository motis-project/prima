import { fail } from '@sveltejs/kit';
import { prepareVehicleUAddOrpdate as prepareVehicleAddOrpdate } from '../prepareVehicleData';
import { db } from '$lib/server/db';
import type { Actions, RequestEvent } from './$types';
import { msg } from '$lib/msg';

export async function load({ params, locals }) {
	const vehicle = await db
		.selectFrom('rideShareVehicle')
		.where('id', '=', parseInt(params.slug))
		.selectAll()
		.executeTakeFirst();
	if (vehicle === undefined) {
		return fail(400);
	}
	if (locals.session!.userId !== vehicle.owner) {
		return fail(403);
	}
	return vehicle;
}

export const actions: Actions = {
	editVehicle: async function (event: RequestEvent) {
		const user = event.locals.session?.userId;
		if (!user) {
			throw 'user not defined';
		}
		const formData = await event.request.formData();
		const vehicleIdString = formData.get('vehicleId');
		if (typeof vehicleIdString !== 'string') {
			return fail(400);
		}
		const vehicleId = parseInt(vehicleIdString);
		if (isNaN(vehicleId)) {
			return fail(400);
		}
		const vehicle = await db
			.selectFrom('rideShareVehicle')
			.where('owner', '=', user)
			.where('id', '=', vehicleId)
			.select('id')
			.executeTakeFirst();
		if (vehicle === undefined) {
			return fail(403);
		}
		const data = await prepareVehicleAddOrpdate(formData, user);
		if (!('luggage' in data)) {
			return data;
		}
		try {
			const updateData: Record<string, string | number | boolean | null> = {
				passengers: data.passengers,
				luggage: data.luggage,
				owner: user,
				smokingAllowed: data.smokingAllowed,
				color: data.color,
				model: data.model,
				licensePlate: data.licensePlate
			};

			if (data.vehiclePicturePath !== null) {
				updateData.picture = data.vehiclePicturePath;
			}
			console.log(
				'edited ride share vehicle with id: ',
				vehicle!.id,
				await db
					.updateTable('rideShareVehicle')
					.set(updateData)
					.where('rideShareVehicle.id', '=', vehicleId)
					.executeTakeFirstOrThrow()
			);

			return {
				success: true,
				msg: msg('vehicleEditedSuccessfully', 'success')
			};
		} catch (e) {
			return fail(400, {
				/* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
				msg: msg((<any>e).constraint ? 'duplicateLicensePlate' : 'unknownError')
			});
		}
	}
};
