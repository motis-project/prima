import type { Capacities } from '$lib/util/booking/Capacities';
import { type Database } from '$lib/server/db';
import { sql, Transaction } from 'kysely';
import { env } from '$env/dynamic/public';
import type { ScheduledTimes } from './getScheduledTimes';
import type { BookRideShareResponse, ExpectedConnection } from './bookRide';

export async function insertRideShareRequest(
	r: BookRideShareResponse,
	capacities: Capacities,
	c: ExpectedConnection,
	customer: number,
	scheduledTimes: ScheduledTimes,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	trx: Transaction<Database>
): Promise<number> {
	const nextLegUpdates = [{ event: r.best.prevPickupId, duration: r.best.pickupPrevLegDuration }];
	if (r.best.prevDropoffId !== r.best.prevPickupId) {
		nextLegUpdates.push({
			event: r.best.prevDropoffId,
			duration: r.best.dropoffPrevLegDuration
		});
	}
	const prevLegUpdates = [{ event: r.best.nextDropoffId, duration: r.best.dropoffNextLegDuration }];
	if (r.best.nextDropoffId !== r.best.nextPickupId) {
		prevLegUpdates.push({
			event: r.best.nextPickupId,
			duration: r.best.pickupNextLegDuration
		});
	}
	console.log({ prevLegUpdates: nextLegUpdates }, { nextLegUpdates: prevLegUpdates });
	const ticketPrice = capacities.passengers * parseInt(env.PUBLIC_FIXED_PRICE);
	const ticketCode = '';
	const requestId = (
		await sql<{ request: number }>`
        SELECT add_ride_share_request(
            ROW(${capacities.passengers}, ${kidsZeroToTwo}, ${kidsThreeToFour}, ${kidsFiveToSix}, ${capacities.wheelchairs}, ${capacities.bikes}, ${capacities.luggage}, ${customer}, ${ticketPrice}, ${ticketCode}),
            ROW(${true}, ${c.start.lat}, ${c.start.lng}, ${r.best.scheduledPickupTimeStart}, ${r.best.scheduledPickupTimeEnd}, ${r.best.pickupTime}, ${r.best.pickupPrevLegDuration}, ${r.best.pickupNextLegDuration}, ${c.start.address}, ${r.pickupEventGroup ?? null}),
            ROW(${false}, ${c.target.lat}, ${c.target.lng}, ${r.best.scheduledDropoffTimeStart}, ${r.best.scheduledDropoffTimeEnd}, ${r.best.dropoffTime}, ${r.best.dropoffPrevLegDuration}, ${r.best.dropoffNextLegDuration}, ${c.target.address}, ${r.dropoffEventGroup ?? null}),
            ${r.best.tour},
            ${JSON.stringify(scheduledTimes.updates)}::jsonb,
            ${JSON.stringify(prevLegUpdates)}::jsonb,
            ${JSON.stringify(nextLegUpdates)}::jsonb
       ) AS request`.execute(trx)
	).rows[0].request;
	return requestId;
}
