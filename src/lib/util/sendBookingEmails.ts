import { Mode } from '$lib/server/booking/mode';
import { getBlurredAddress } from '$lib/server/booking/rideShare/getRideShareToursAsItinerary';
import type { Database } from '$lib/server/db';
import type { ExpressionBuilder, Kysely } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import NewRide from '$lib/server/email/NewRide.svelte';
import NewRideSharingRequest from '$lib/server/email/NewRideSharingRequest.svelte';

export async function sendBookingMails(
	request1: number | null,
	mode: Mode | undefined,
	db: Kysely<Database>,
	/* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
	sendMail: (template: any, subject: string, email: string, props: any) => Promise<void>
) {
	try {
		const getEvents = (eb: ExpressionBuilder<Database, 'request'>, outer: boolean) => [
			jsonObjectFrom(
				eb
					.selectFrom('event')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.where('event.request', '=', request1)
					.orderBy('eventGroup.scheduledTimeStart', 'asc')
					.limit(1)
					.select(['scheduledTimeStart as time', 'address', 'lat', 'lng'])
			).as('firstEvent'),
			jsonObjectFrom(
				eb
					.selectFrom('event')
					.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
					.where('event.request', '=', request1)
					.orderBy('eventGroup.scheduledTimeStart', 'desc')
					.limit(1)
					.select([
						outer ? 'scheduledTimeEnd as time' : 'scheduledTimeStart as time',
						'address',
						'lat',
						'lng'
					])
			).as('lastEvent')
		];

		if (mode == Mode.TAXI) {
			console.log('SENDING EMAIL TO TAXI OWNERS');
			const rideInfo = await db
				.selectFrom('request')
				.innerJoin('tour', 'request.tour', 'tour.id')
				.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
				.innerJoin('user', 'vehicle.company', 'user.companyId')
				.select((eb) => ['user.email', 'user.name', 'tour.id as tourId', ...getEvents(eb, false)])
				.where('request.id', '=', request1)
				.where('user.isTaxiOwner', '=', true)
				.execute();
			await Promise.all(rideInfo.map((r) => sendMail(NewRide, 'Neue Beförderung', r.email, r)));
		} else {
			console.log('SENDING EMAIL TO RIDE SHARE PROVIDER');
			const rideInfo = await db
				.selectFrom('request')
				.innerJoin('rideShareTour', 'request.rideShareTour', 'rideShareTour.id')
				.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
				.innerJoin('user as provider', 'rideShareVehicle.owner', 'provider.id')
				.innerJoin('user as passenger', 'request.customer', 'passenger.id')
				.select((eb) => [
					'provider.email as providerMail',
					'provider.name as providerName',
					'passenger.email as passengerMail',
					'passenger.name as passengerName',
					'passenger.phone as passengerPhone',
					'rideShareTour.id as tourId',
					'rideShareTour.communicatedStart as journeyTime',
					...getEvents(eb, true),
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.innerJoin('request', 'request.id', 'event.request')
						.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
						.orderBy('eventGroup.scheduledTimeStart', 'asc')
						.limit(1)
						.select('address')
						.as('journeyFirst'),
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.innerJoin('request', 'request.id', 'event.request')
						.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
						.orderBy('eventGroup.scheduledTimeStart', 'desc')
						.limit(1)
						.select('address')
						.as('journeyLast')
				])
				.where('request.id', '=', request1)
				.execute();
			await Promise.all(
				rideInfo.map(async (r) => {
					r.firstEvent!.address = await getBlurredAddress(r.firstEvent!);
					r.lastEvent!.address = await getBlurredAddress(r.lastEvent!);
					return sendMail(NewRideSharingRequest, 'Neue Mitfahr-Anfrage', r.providerMail, r);
				})
			);
		}
	} catch {
		/* nothing we can do about this */
	}
}
