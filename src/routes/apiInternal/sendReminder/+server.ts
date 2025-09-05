import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { HOUR, MINUTE } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import ReminderCompany from '$lib/server/email/ReminderCompany.svelte';
import ReminderCustomer from '$lib/server/email/ReminderCustomer.svelte';

const REMINDER_OFFSET = 2 * HOUR;
const REMINDER_BUCKET = 2000 * MINUTE;

export const POST = async (_: RequestEvent) => {
	console.log('Sending reminders.');
	const now = Date.now();
	await db.transaction().execute(async (trx) => {
		const imminentTours = await trx
			.selectFrom('tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('user', 'vehicle.company', 'user.companyId')
			.where('tour.departure', '>', now + REMINDER_OFFSET)
			.where('tour.departure', '<', now + REMINDER_OFFSET + REMINDER_BUCKET)
			.where('tour.cancelled', '=', false)
			.where('user.isTaxiOwner', '=', true)
			.select(['tour.id', 'user.email', 'vehicle.licensePlate', 'tour.departure', 'tour.arrival'])
			.execute();
		for (const tour of imminentTours) {
			console.log(tour);
			try {
				console.log('Sending ReminderCompany to ', tour.email);
				await sendMail(ReminderCompany, 'Bevorstehende Fahrt', tour.email, tour);
			} catch {
				console.log(
					'Failed to send ReminderCompany to company with email: ',
					tour.email,
					' tourId: ',
					tour.id
				);
			}
		}

		const requests = await trx
			.selectFrom('journey')
			.innerJoin('request', 'journey.request1', 'request.id')
			.innerJoin('user', 'user.id', 'request.customer')
			.innerJoin('tour', 'tour.id', 'request.tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('event', 'event.request', 'request.id')
			.where('event.isPickup', '=', true)
			.where('event.communicatedTime', '>', now + REMINDER_OFFSET)
			.where('event.communicatedTime', '<', now + REMINDER_OFFSET + REMINDER_BUCKET)
			.where('request.cancelled', '=', false)
			.select((eb) => [
				'user.name',
				'user.email',
				'journey.id as journeyId',
				'request.id as requestId',
				'vehicle.licensePlate',
				'tour.id as tourId',
				jsonArrayFrom(
					eb
						.selectFrom('event')
						.whereRef('event.request', '=', 'request.id')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.select(['event.communicatedTime', 'eventGroup.address'])
				).as('events')
			])
			.execute();
		console.log(requests);
		for (const request of requests) {
			try {
				console.log('Sending ReminderCustomer to ', request.email);
				await sendMail(ReminderCustomer, 'Bevorstehende Fahrt', request.email, {
					journeyId: request.journeyId,
					events: request.events,
					name: request.name,
					licensePlate: request.licensePlate
				});
			} catch {
				console.log(
					'Failed to send ReminderCustomer to customer with email: ',
					request.email,
					' tourId: ',
					request.tourId
				);
			}
		}
	});
	return json({});
};
