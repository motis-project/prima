import type { Capacities } from '$lib/util/booking/Capacities';
import { type Database } from '$lib/server/db';
import { sql, Transaction } from 'kysely';
import type { BookRideShareResponse, ExpectedConnection } from './bookRide';

export async function insertRideShareRequest(
	r: BookRideShareResponse,
	capacities: Capacities,
	c: ExpectedConnection,
	customer: number,
	busStopTime: number,
	requestedTime: number,
	startFixed: boolean,
	trx: Transaction<Database>
): Promise<number> {
	const requestId = (
		await sql<{ request: number }>`
        SELECT add_ride_share_request(
            ROW(${capacities.passengers}, ${capacities.luggage}, ${customer}, ${busStopTime}, ${requestedTime}, ${startFixed}),
            ROW(${true}, ${c.start.lat}, ${c.start.lng}, ${r.best.scheduledPickupTimeStart}, ${r.best.scheduledPickupTimeEnd}, ${r.best.pickupTime}, ${r.best.pickupPrevLegDuration}, ${r.best.pickupNextLegDuration}, ${c.start.address}, ${null}),
            ROW(${false}, ${c.target.lat}, ${c.target.lng}, ${r.best.scheduledDropoffTimeStart}, ${r.best.scheduledDropoffTimeEnd}, ${r.best.dropoffTime}, ${r.best.dropoffPrevLegDuration}, ${r.best.dropoffNextLegDuration}, ${c.target.address}, ${null}),
            ${r.best.tour}
       ) AS request`.execute(trx)
	).rows[0].request;
	return requestId;
}
