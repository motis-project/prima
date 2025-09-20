import { db } from '$lib/server/db';
import { sendMail } from '$lib/server/sendMail';
import { HOUR, MINUTE } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import ReminderCompany from '$lib/server/email/ReminderCompany.svelte';
import ReminderCustomer from '$lib/server/email/ReminderCustomer.svelte';
import { TourChange } from '$lib/server/firebase/firebase';
import { sendNotifications } from '$lib/server/firebase/notifications';
// @ts-expect-error Cannot find module 'svelte-qrcode'
import QRCode from 'qrcode';

const REMINDER_OFFSET_COMPANY = 1 * HOUR;
const REMINDER_OFFSET_CUSTOMER = 2 * HOUR;
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
			.where('tour.departure', '>=', framed_now + REMINDER_OFFSET_COMPANY)
			.where('tour.departure', '<', framed_now + REMINDER_OFFSET_COMPANY + REMINDER_FRAME)
			.where('tour.cancelled', '=', false)
			.where('user.isTaxiOwner', '=', true)
			.select((eb) => [
				'tour.id',
				'user.email',
				'vehicle.licensePlate',
				'vehicle.id as vehicleId',
				'vehicle.company',
				jsonArrayFrom(
					eb
						.selectFrom('event')
						.innerJoin('request', 'request.id', 'event.request')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.whereRef('request.tour', '=', 'tour.id')
						.where('event.cancelled', '=', false)
						.select(['eventGroup.scheduledTimeStart', 'eventGroup.address'])
				).as('events')
			])
			.execute();
		for (const tour of imminentTours) {
			try {
				console.log('Sending ReminderCompany to ', tour.email);
				await sendMail(ReminderCompany, 'Bevorstehende Fahrt', tour.email, tour);
			} catch (e) {
				console.log(e);
				console.log(
					'Failed to send ReminderCompany to company with email: ',
					tour.email,
					' tourId: ',
					tour.id
				);
			}
			const firstEvent = tour.events.sort((e) => e.scheduledTimeStart)[0];
			await sendNotifications(tour.company, {
				tourId: tour.id,
				pickupTime: firstEvent.scheduledTimeStart,
				wheelchairs: 0,
				vehicleId: tour.vehicleId,
				change: TourChange.REMINDER
			});
		}

		const requests = await trx
			.selectFrom('journey')
			.innerJoin('request', 'journey.request1', 'request.id')
			.innerJoin('user', 'user.id', 'request.customer')
			.innerJoin('tour', 'tour.id', 'request.tour')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('event', 'event.request', 'request.id')
			.where('event.isPickup', '=', true)
			.where('event.communicatedTime', '>=', framed_now + REMINDER_OFFSET_CUSTOMER)
			.where('event.communicatedTime', '<', framed_now + REMINDER_OFFSET_CUSTOMER + REMINDER_FRAME)
			.where('request.cancelled', '=', false)
			.where('user.isService', '=', false)
			.select((eb) => [
				'user.firstName',
				'user.name',
				'user.email',
				'journey.id as journeyId',
				'request.id as requestId',
				'request.ticketCode',
				'request.ticketPrice',
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
					name: request.firstName + ' ' +request.name,
					licensePlate: request.licensePlate,
					ticketCode: request.ticketCode,
					ticketCodeQr: await QRCode.toDataURL(request.ticketCode),
					ticketPrice: request.ticketPrice
				});
			} catch (e) {
				console.log(e);
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
