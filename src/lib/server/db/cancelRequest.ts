import { sql, Transaction } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { sendMail } from '$lib/server/sendMail';
import CancelNotificationCompany from '$lib/server/email/CancelNotificationCompany.svelte';
import { updateDirectDurations } from '$lib/server/booking/updateDirectDuration';
import { db, type Database } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';

export const cancelRequest = async (requestId: number, userId: number) => {
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
							'event.lat',
							'event.lng',
							'request.id as requestid',
							'cancelled_tour.id as tourid',
							'event.id as eventid'
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
						.select(['user.name', 'user.email', 'company.lat', 'company.lng'])
				).as('companyOwners')
			])
			.executeTakeFirst();
		if (tour === undefined) {
			return;
		}
		if (tour.ticketChecked === true) {
			return;
		}
		const queryResult = await sql<boolean>`SELECT cancel_request(${requestId}, ${userId}, ${Date.now()}) AS wasTourCancelled`
			.execute(trx);
		console.assert(queryResult.rows.length === 1);
		if (queryResult.rows[0]) {
			await updateDirectDurations(tour.vehicle, tour.id, tour.departure, trx);
		} else {
			updateLegDurations(
				tour.events,
				{ lat: tour.companyOwners[0].lat!, lng: tour.companyOwners[0].lng! },
				requestId,
				trx
			);
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
	});
};

async function updateLegDurations(
	events: {
		cancelled: boolean;
		scheduledTimeStart: number;
		scheduledTimeEnd: number;
		lat: number;
		lng: number;
		requestid: number;
		tourid: number;
		eventid: number;
	}[],
	company: maplibregl.LngLatLike,
	requestId: number,
	trx: Transaction<Database>
) {
	const update = async (
		prevIdx: number,
		nextIdx: number,
		events: {
			cancelled: boolean;
			scheduledTimeStart: number;
			scheduledTimeEnd: number;
			lat: number;
			lng: number;
			requestid: number;
			tourid: number;
			eventid: number;
		}[],
		company: maplibregl.LngLatLike,
		trx: Transaction<Database>
	) => {
		if (prevIdx === -1) {
			await trx
				.updateTable('event')
				.set({ prevLegDuration: (await oneToManyCarRouting(events[nextIdx], [company], false))[0] })
				.where('event.id', '=', events[nextIdx].eventid)
				.executeTakeFirst();
			return;
		}
		if (nextIdx === events.length) {
			await trx
				.updateTable('event')
				.set({ prevLegDuration: (await oneToManyCarRouting(events[prevIdx], [company], true))[0] })
				.where('event.id', '=', events[prevIdx].eventid)
				.executeTakeFirst();
			return;
		}
		const duration = (await oneToManyCarRouting(events[prevIdx], [events[nextIdx]], false))[0];
		await trx
			.updateTable('event')
			.set({ nextLegDuration: duration })
			.where('event.id', '=', events[prevIdx].eventid)
			.executeTakeFirst();
		await trx
			.updateTable('event')
			.set({ prevLegDuration: duration })
			.where('event.id', '=', events[nextIdx].eventid)
			.executeTakeFirst();
	};

	events.filter((e) => e.requestid === requestId || e.cancelled === false);
	events.sort((e) => e.scheduledTimeStart);
	const cancelled1Idx = events.findIndex((e) => e.requestid === requestId);
	const cancelled2Idx = events.findLastIndex((e) => e.requestid === requestId);
	console.assert(cancelled1Idx != -1 && cancelled2Idx != -1 && cancelled1Idx < cancelled2Idx);
	if (cancelled1Idx === cancelled2Idx - 1) {
		await update(cancelled1Idx - 1, cancelled2Idx + 1, events, company, trx);
		return;
	}
	await update(cancelled1Idx - 1, cancelled1Idx + 1, events, company, trx);
	await update(cancelled2Idx - 1, cancelled2Idx + 1, events, company, trx);
}
