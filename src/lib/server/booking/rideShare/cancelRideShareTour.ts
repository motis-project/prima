import { sql } from 'kysely';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCustomer from '$lib/server/email/CancelNotificationCustomer.svelte';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { db } from '$lib/server/db';
import { retry } from '$lib/server/db/retryQuery';

export async function cancelRideShareTour(
	tourId: number,
	user: number,
	hash?: string
): Promise<{ status?: number; message?: string }> {
	await retry(() =>
		db.transaction().execute(async (trx) => {
			let cancelIds: number[] = [];
			if (hash !== undefined) {
				cancelIds = (
					await trx
						.selectFrom('rideShareTour')
						.where('rideShareTour.hash', '=', hash)
						.where((eb) =>
							eb.exists(
								eb
									.selectFrom('request')
									.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
									.where('request.pending', '=', false)
									.where('request.startFixed', 'is not', null)
							)
						)
						.select('rideShareTour.id')
						.execute()
				).map((e) => e.id);
			}
			if (!cancelIds.some((id) => id === tourId)) {
				cancelIds.push(tourId);
			}
			for (const currentId of cancelIds) {
				const tour = await trx
					.selectFrom('rideShareTour')
					.where('rideShareTour.id', '=', currentId)
					.select((eb) => [
						'rideShareTour.vehicle',
						'rideShareTour.id',
						jsonArrayFrom(
							eb
								.selectFrom('request')
								.innerJoin('user', 'user.id', 'request.customer')
								.whereRef('rideShareTour.id', '=', 'request.rideShareTour')
								.select((eb) => [
									'user.email',
									'user.name',
									'user.firstName',
									jsonArrayFrom(
										eb
											.selectFrom('event')
											.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
											.whereRef('event.request', '=', 'request.id')
											.orderBy('isPickup', 'desc')
											.select([
												'eventGroup.address',
												'event.communicatedTime',
												'eventGroup.scheduledTimeStart',
												'eventGroup.scheduledTimeEnd',
												'isPickup'
											])
									).as('events')
								])
						).as('requests')
					])
					.executeTakeFirst();
				if (tour === undefined) {
					console.log(
						'Cancel Tour early exit - cannot find Ride Sharing Tour in Database. tourId: ',
						currentId
					);
					return {};
				}
				await sql`CALL cancel_ride_share_tour(${currentId}, ${user}, ${Date.now()})`.execute(trx);
				console.assert(tour.requests.length != 0, 'Found a tour with no requests');
				for (const request of tour.requests) {
					console.assert(request.events.length != 0, 'Found a request with no events');
					try {
						await sendMail(
							CancelNotificationCustomer,
							'Stornierte Mitfahrgelegenheit',
							request.email,
							{
								start: request.events[0].address,
								target: request.events[1].address,
								startTime: request.events[0].communicatedTime,
								name: request.firstName + ' ' + request.name
							}
						);
					} catch {
						console.log(
							'Failed to send cancellation email to ride share customer with email: ',
							request.email,
							' tourId: ',
							currentId
						);
						return {};
					}
				}
			}
		})
	);
	console.log('Cancel Ride Sharing Tour succes. tourId: ', tourId);
	return {};
}
