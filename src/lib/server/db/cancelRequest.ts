import { sql } from 'kysely';
import { db } from '.';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';

export const cancelRequest = async (requestId: number, userId: number) => {
	console.log(
		'Cancel Request PARAMS START: ',
		JSON.stringify({ requestId, userId }, null, '\t'),
		'Cancel Request PARAMS END'
	);
	await db.transaction().execute(async (trx) => {
		await sql`LOCK TABLE tour, request, event, "user" IN ACCESS EXCLUSIVE MODE;`.execute(trx);
		const tour = await trx
			.selectFrom('request as cancelled_request')
			.where('cancelled_request.id', '=', requestId)
			.innerJoin('tour', 'tour.id', 'cancelled_request.tour')
			.select((eb) => [
				'tour.id',
				'tour.departure',
				'cancelled_request.ticketChecked',
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
						.select(['user.name', 'user.email'])
				).as('companyOwners')
			])
			.executeTakeFirst();
		if (tour === undefined) {
			console.log(
				'Cancel Request early exit - cannot find request in database. requestId: ',
				requestId
			);
			return;
		}
		if (tour.ticketChecked === true) {
			console.log(
				'Cancel Request early exit - the ticket of the user trying to cancel is already checked: ',
				requestId
			);
			return;
		}
		await sql`CALL cancel_request(${requestId}, ${userId}, ${Date.now()})`.execute(trx);
		for (const companyOwner of tour.companyOwners) {
			try {
				await sendMail(CancelNotificationCompany, 'Stornierte Buchung', companyOwner.email, {
					events: tour.events,
					name: companyOwner.name,
					departure: tour.departure
				});
			} catch {
				console.log(
					'Failed to send cancellation email to company with email: ',
					companyOwner.email,
					' tourId: ',
					tour.id
				);
			}
		}
		console.log('Cancel Request success. requestId: ', requestId);
	});
};
