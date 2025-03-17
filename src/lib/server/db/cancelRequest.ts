import { sql } from 'kysely';
import { db } from '.';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';

export const cancelRequest = async (requestId: number, userId: number) => {
	await sql`CALL cancel_request(${requestId}, ${userId}, ${Date.now()})`.execute(db);
	const tour = await db
		.selectFrom('request as cancelled_request')
		.where('cancelled_request.id', '=', requestId)
		.innerJoin('tour', 'tour.id', 'cancelled_request.tour')
		.select((eb) => [
			'tour.id',
			'tour.departure',
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
		return;
	}
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
};
