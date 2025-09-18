import { sql } from 'kysely';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCustomer from '$lib/server/email/CancelNotificationCustomer.svelte';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendNotifications } from '$lib/server/firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { updateDirectDurations } from '$lib/server/booking/updateDirectDuration';
import { db } from '$lib/server/db';
import { retry } from './db/retryQuery';

export async function cancelTour(
	tourId: number,
	message: string,
	company: number
): Promise<{ status?: number; message?: string }> {
	await retry(() =>
		db.transaction().execute(async (trx) => {
			const tour = await trx
				.selectFrom('tour')
				.where('tour.id', '=', tourId)
				.select((eb) => [
					'tour.fare',
					'tour.vehicle',
					'tour.id',
					'tour.departure',
					jsonArrayFrom(
						eb
							.selectFrom('request')
							.innerJoin('user', 'user.id', 'request.customer')
							.whereRef('tour.id', '=', 'request.tour')
							.select((eb) => [
								'user.email',
								'user.name',
								'user.firstName',
								'request.ticketChecked',
								'request.wheelchairs',
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
				console.log('Cancel Tour early exit - cannot find Tour in Database. tourId: ', tourId);
				return {};
			}
			if (tour.requests.some((r) => r.ticketChecked)) {
				console.log('Cancel Tour early exit - Tour had scanned ticket. tourId: ', tourId);
				return {
					status: 400,
					message: 'Es wurde bereits ein Ticket gescannt - die Tour kann nicht storniert werden.'
				};
			}
			if (tour.fare !== null) {
				console.log('Cancel Tour early exit - fare was already registered. tourId: ', tourId);
				return {
					status: 400,
					message:
						'Der Taxameterstand wurde bereits eingetragen - die Tour kann nicht storniert werden.'
				};
			}
			await sql`CALL cancel_tour(${tourId}, ${company}, ${message})`.execute(trx);
			await updateDirectDurations(tour.vehicle, tour.id, tour.departure, trx);
			console.assert(tour.requests.length != 0, 'Found a tour with no requests');
			for (const request of tour.requests) {
				console.assert(request.events.length != 0, 'Found a request with no events');
				try {
					await sendMail(CancelNotificationCustomer, 'Stornierte Buchung', request.email, {
						start: request.events[0].address,
						target: request.events[1].address,
						startTime: request.events[0].communicatedTime,
						name: request.firstName + ' ' + request.name
					});
				} catch {
					console.log(
						'Failed to send cancellation email to customer with email: ',
						request.email,
						' tourId: ',
						tourId
					);
					return {};
				}
			}

			const firstEvent = tour.requests
				.flatMap((r) => r.events)
				.sort((e) => e.scheduledTimeStart)[0];
			const wheelchairs = tour.requests.reduce((prev, curr) => prev + curr.wheelchairs, 0);
			await sendNotifications(company, {
				tourId: tourId,
				pickupTime: getScheduledEventTime(firstEvent),
				vehicleId: tour.vehicle,
				wheelchairs,
				change: TourChange.CANCELLED
			});
		})
	);
	console.log('Cancel Tour succes. tourId: ', tourId);
	return {};
}
