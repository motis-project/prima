import { sql } from 'kysely';
import { db } from '.';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';
import { lockTablesStatement } from './lockTables';
import { getScheduledEventTime } from '$lib/util/getScheduledEventTime';
import { sendNotifications } from '../firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';

export const cancelRequest = async (requestId: number, userId: number) => {
	console.log(
		'Cancel Request PARAMS START: ',
		JSON.stringify({ requestId, userId }, null, '\t'),
		' Cancel Request PARAMS END'
	);
	await db.transaction().execute(async (trx) => {
		await lockTablesStatement(['tour', 'request', 'event', 'user']).execute(trx);
		const tour = await trx
			.selectFrom('request')
			.where('request.id', '=', requestId)
			.innerJoin('tour as relevant_tour', 'relevant_tour.id', 'request.tour')
			.select((eb) => [
				'relevant_tour.id as tourId',
				'request.ticketChecked',
				jsonArrayFrom(
					eb
						.selectFrom('request as cancelled_request')
						.where('cancelled_request.id', '=', requestId)
						.innerJoin('tour as relevant_tour', 'cancelled_request.tour', 'relevant_tour.id')
						.innerJoin('request as relevant_request', 'relevant_request.tour', 'relevant_tour.id')
						.select((eb) => [
							'relevant_request.wheelchairs',
							jsonArrayFrom(
								eb
									.selectFrom('event')
									.whereRef('event.request', '=', 'relevant_request.id')
									.select([
										'event.scheduledTimeStart',
										'event.scheduledTimeEnd',
										'event.isPickup',
										'event.request as requestId'
									])
							).as('events')
						])
				).as('requests')
			])
			.executeTakeFirst();
		if (tour === undefined) {
			console.log(
				'Cancel Request early exit - cannot find tour associated with requestId in db. ',
				{ requestId, userId }
			);
			return;
		}
		if (tour.ticketChecked === true) {
			console.log('Cancel Request early exit - cannot cancel request, ticket was checked. ', {
				requestId,
				userId
			});
			return;
		}
		await sql`CALL cancel_request(${requestId}, ${userId}, ${Date.now()})`.execute(trx);
		const tourInfo = await trx
			.selectFrom('request as cancelled_request')
			.where('cancelled_request.id', '=', requestId)
			.innerJoin('tour', 'tour.id', 'cancelled_request.tour')
			.select((eb) => [
				'tour.id',
				'tour.departure',
				'tour.vehicle',
				jsonArrayFrom(
					eb
						.selectFrom('request as cancelled_request')
						.innerJoin('tour as cancelled_tour', 'cancelled_tour.id', 'cancelled_request.tour')
						.innerJoin('request', 'request.tour', 'cancelled_tour.id')
						.innerJoin('event', 'event.request', 'request.id')
						.where('cancelled_request.id', '=', requestId)
						.select([
							'event.address',
							'event.scheduledTimeStart',
							'event.scheduledTimeEnd',
							'event.cancelled',
							'event.isPickup',
							'cancelled_tour.id as tourid'
						])
				).as('events'),
				jsonArrayFrom(
					eb
						.selectFrom('request')
						.innerJoin('tour', 'tour.id', 'request.tour')
						.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
						.innerJoin('company', 'company.id', 'vehicle.company')
						.innerJoin('user', 'user.companyId', 'company.id')
						.where('request.id', '=', requestId)
						.where('user.isTaxiOwner', '=', true)
						.select(['user.name', 'user.email', 'company.id as companyId'])
				).as('companyOwners')
			])
			.executeTakeFirst();
		if (tourInfo === undefined) {
			console.log(
				'Tour was undefined unexpectedly in cancelRequest cannot send notification Emails, requestId: ',
				requestId
			);
			return;
		}
		for (const companyOwner of tourInfo.companyOwners) {
			try {
				await sendMail(CancelNotificationCompany, 'Stornierte Buchung', companyOwner.email, {
					events: tourInfo.events,
					name: companyOwner.name,
					departure: tourInfo.departure
				});
			} catch {
				console.log(
					'Failed to send cancellation email to company with email: ',
					companyOwner.email,
					' tourId: ',
					tourInfo.id
				);
			}
		}

		const firstEvent = tour.requests.flatMap((r) => r.events).sort((e) => e.scheduledTimeStart)[0];
		const wheelchairs = tour.requests.reduce((prev, curr) => prev + curr.wheelchairs, 0);
		if (firstEvent.requestId === requestId && tourInfo.companyOwners.length !== 0) {
			await sendNotifications(tourInfo.companyOwners[0].companyId, {
				tourId: tour.tourId,
				pickupTime: getScheduledEventTime(firstEvent),
				vehicleId: tourInfo.vehicle,
				wheelchairs,
				change: TourChange.CANCELLED
			});
		}

		console.log('Cancel Request - success', { requestId, userId });
	});
};
