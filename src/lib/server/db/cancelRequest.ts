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
					.selectFrom('tour')
					.innerJoin('request', 'tour.id', 'request.tour')
					.innerJoin('event', 'event.request', 'request.id')
					.whereRef('event.request', '=', 'request.id')
					.where('event.cancelled', '=', false)
					.select(['event.address', 'event.scheduledTimeStart', 'event.scheduledTimeEnd'])
			).as('events'),
			jsonArrayFrom(
				eb
					.selectFrom('tour')
					.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
					.innerJoin('company', 'company.id', 'vehicle.company')
					.innerJoin('user', 'user.companyId', 'company.id')
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
