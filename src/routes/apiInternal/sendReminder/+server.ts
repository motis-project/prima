import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { HOUR, MINUTE } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import ReminderCompany from '$lib/server/email/ReminderCompany.svelte';
import ReminderCustomer from '$lib/server/email/ReminderCustomer.svelte';

const REMINDER_OFFSET = 2 * HOUR;
const REMINDER_FRAME = 5 * MINUTE;
const REMINDER_FRAME_PHASE = 2 * MINUTE;

export const POST = async (_: RequestEvent) => {
	console.log('Sending reminders.');
	const framed_now =
		Math.floor((Date.now() + REMINDER_FRAME_PHASE) / REMINDER_FRAME) * REMINDER_FRAME;
	await db.transaction().execute(async (trx) => {
		const imminentTours = await trx
			.selectFrom('tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('user', 'vehicle.company', 'user.companyId')
			.where('tour.departure', '>=', framed_now + REMINDER_OFFSET)
			.where('tour.departure', '<', framed_now + REMINDER_OFFSET + REMINDER_FRAME)
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
			.where('event.communicatedTime', '>=', framed_now + REMINDER_OFFSET)
			.where('event.communicatedTime', '<', framed_now + REMINDER_OFFSET + REMINDER_FRAME)
			.where('request.cancelled', '=', false)
			.where('user.isService', '=', false)
			.select((eb) => [
				'user.name',
				'user.email',
				'journey.id as journeyId',
				'request.id as requestId',
				'request.ticketCode as ticketCode',
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
		for (const request of requests) {
			try {
				console.log('Sending ReminderCustomer to ', request.email);
				await sendMail(ReminderCustomer, 'Bevorstehende Fahrt', request.email, {
					journeyId: request.journeyId,
					events: request.events,
					name: request.name,
					licensePlate: request.licensePlate,
					ticketCode: request.ticketCode
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
		if (requests.length === 0) {
			return;
		}
		const requestIds = requests.map((r) => r.requestId);
		await trx
			.updateTable('request')
			.set({ licensePlateUpdatedAt: null })
			.where('id', 'in', requestIds)
			.execute();
	});
	return json({});
};
