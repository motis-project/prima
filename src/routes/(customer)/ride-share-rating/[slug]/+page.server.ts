import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm';
import { msg } from '$lib/msg';

export const load: PageServerLoad = async ({ params, locals }) => {
	const journey = await db
		.selectFrom('request')
		.innerJoin('rideShareTour', 'request.rideShareTour', 'rideShareTour.id')
		.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
		.innerJoin('user as provider', 'provider.id', 'rideShareVehicle.owner')
		.innerJoin('journey', (join) =>
			join.on((eb) =>
				eb.or([
					eb('journey.request1', '=', eb.ref('request.id')),
					eb('journey.request2', '=', eb.ref('request.id'))
				])
			)
		)
		.leftJoin('rideShareRating', 'rideShareRating.request', 'request.id')
		.select([
			'request.id',
			'rideShareRating.rating',
			'provider.name',
			'provider.firstName',
			'journey.json as journey',
			'request.customer'
		])
		.where('request.id', '=', parseInt(params.slug))
		.where((eb) =>
			eb.or([
				eb('request.customer', '=', locals.session!.userId),
				eb('provider.id', '=', locals.session!.userId)
			])
		)
		.executeTakeFirst();
	if (journey == undefined) {
		error(404, 'Not found');
	}

	return {
		journey: journey.journey,
		name: journey.name,
		firstName: journey.firstName,
		isCustomer: journey.customer === locals.session!.userId,
		id: params.slug
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = locals.session!.userId!;
		const formData = await request.formData();

		const requestId = readInt(formData.get('id'));
		const rating = readInt(formData.get('rating'));
		const givenStr = formData.get('given');
		const isCustomerStr = formData.get('isCustomer');

		if (
			isNaN(requestId) ||
			isNaN(rating) ||
			givenStr !== 'true' ||
			(isCustomerStr !== 'true' && isCustomerStr !== 'false')
		) {
			return fail(400, { msg: msg('feedbackMissing') });
		}
		const isCustomer = isCustomerStr === 'true';
		const hasPermissionToRate =
			(isCustomer
				? await db
						.selectFrom('request')
						.where('request.customer', '=', user)
						.select('request.id')
						.executeTakeFirst()
				: await db
						.selectFrom('request')
						.innerJoin('rideShareTour', 'request.rideShareTour', 'rideShareTour.id')
						.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
						.where('rideShareVehicle.owner', '=', user)
						.select('request.id')
						.executeTakeFirst()) === undefined;
		if (rating < 1 || rating > 5 || hasPermissionToRate) {
			return fail(403);
		}

		await db
			.insertInto('rideShareRating')
			.values({
				request: requestId,
				rating: rating,
				ratedIsCustomer: !isCustomer
			})
			.execute();

		return { msg: msg('feedbackThank', 'success') };
	}
};
