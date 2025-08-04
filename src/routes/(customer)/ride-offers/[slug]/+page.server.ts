import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { msg, type Msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { cancelRequest } from '$lib/server/db/cancelRequest';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('journey')
		.leftJoin('request', 'journey.request1', 'request.id')
		.leftJoin('event', 'event.request', 'request.id')
		.leftJoin('tour', 'tour.id', 'request.tour')
		.leftJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.orderBy('event.communicatedTime', 'asc')
		.select([
			'json',
			'request.passengers',
			'request.luggage',
			'request.wheelchairs',
			'request.cancelled',
			'request.ticketCode',
			'request.ticketChecked',
			'request.ticketPrice',
			'request.customer',
			'request.id as requestId',
			'request.kidsZeroToTwo',
			'request.kidsThreeToFour',
			'request.kidsFiveToSix',
			'event.communicatedTime',
			'vehicle.licensePlate',
			'journey.id as journeyId'
		])
		.where('journey.id', '=', parseInt(params.slug))
		.where('user', '=', locals.session!.userId!)
		.limit(1)
		.executeTakeFirst();

	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		...journey,
		journey: journey.json,
		negotiating: [
			{
				// TODO
				name: 'Dummy',
				email: 'email@email.com',
				phone: '115',
				journey: journey.json
			}
		]
	};
};

export const actions = {
	cancel: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const formData = await request.formData();
		const requestId = readInt(formData.get('requestId'));
		await cancelRequest(requestId, locals.session!.userId!);
		return { msg: msg('requestCancelled', 'success') };
	},
	remove: async ({ request, locals }) => {
		const formData = await request.formData();
		const journeyId = readInt(formData.get('journeyId'));
		await db
			.deleteFrom('journey')
			.where('journey.id', '=', journeyId)
			.where('user', '=', locals.session!.userId!)
			.execute();
		return redirect(302, `/bookings`);
	}
};
