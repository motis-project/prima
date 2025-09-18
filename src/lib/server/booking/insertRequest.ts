import type { BookRideResponse, ExpectedConnection } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import { type Database } from '$lib/server/db';
import { sql, Transaction } from 'kysely';
import { sendNotifications } from '$lib/server/firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';
import { env } from '$env/dynamic/public';
import crypto from 'crypto';

export async function insertRequest(
	r: BookRideResponse,
	capacities: Capacities,
	c: ExpectedConnection,
	customer: number,
	withoutQr: boolean,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	trx: Transaction<Database>
): Promise<number> {
	r.mergeTourList = r.mergeTourList.filter((id) => id != r.best.tour);
	const mergeTourListSql =
		r.mergeTourList.length > 0
			? sql`ARRAY[${sql.join(
					r.mergeTourList.map((id) => sql`${id}`),
					sql`,`
				)}]::INTEGER[]`
			: sql`ARRAY[]::INTEGER[]`;
	const ticketCode = withoutQr
		? crypto.randomInt(10000, 100000)
		: crypto.createHash('md5').update(crypto.randomUUID()).digest('hex');
	const ticketPrice =
		(capacities.passengers - kidsZeroToTwo - kidsThreeToFour - kidsFiveToSix) *
		parseInt(env.PUBLIC_FIXED_PRICE);
	const requestId = (
		await sql<{ request: number }>`
        SELECT create_and_merge_tours(
            ROW(${capacities.passengers}, ${kidsZeroToTwo}, ${kidsThreeToFour}, ${kidsFiveToSix}, ${capacities.wheelchairs}, ${capacities.bikes}, ${capacities.luggage}, ${customer}, ${ticketPrice}, ${ticketCode})::request_type,
            ROW(${true}, ${c.start.lat}, ${c.start.lng}, ${r.best.scheduledPickupTimeStart}, ${r.best.scheduledPickupTimeEnd}, ${r.best.pickupTime}, ${r.best.pickupPrevLegDuration}, ${r.best.pickupNextLegDuration}, ${c.start.address}, ${r.pickupEventGroup ?? null})::event_type,
            ROW(${false}, ${c.target.lat}, ${c.target.lng}, ${r.best.scheduledDropoffTimeStart}, ${r.best.scheduledDropoffTimeEnd}, ${r.best.dropoffTime}, ${r.best.dropoffPrevLegDuration}, ${r.best.dropoffNextLegDuration}, ${c.target.address}, ${r.dropoffEventGroup ?? null})::event_type,
            ${mergeTourListSql},
            ROW(${r.best.departure ?? null}, ${r.best.arrival ?? null}, ${r.best.vehicle}, ${r.directDurations.thisTour?.directDrivingDuration ?? null}, ${r.best.tour ?? null})::tour_type,
            ROW(${r.directDurations.nextTour?.tourId ?? null}, ${r.directDurations.nextTour?.directDrivingDuration ?? null})::direct_duration_type,
            ROW(${r.directDurations.thisTour?.tourId ?? null}, ${r.directDurations.thisTour?.directDrivingDuration ?? null})::direct_duration_type,
			${JSON.stringify(r.scheduledTimes.updates)}::jsonb,
			${JSON.stringify(r.prevLegDurations)}::jsonb,
			${JSON.stringify(r.nextLegDurations)}::jsonb
       ) AS request`.execute(trx)
	).rows[0].request;

	const notificationParams = await trx
		.selectFrom('tour')
		.innerJoin('request', 'request.tour', 'tour.id')
		.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
		.where('request.id', '=', requestId)
		.select(['tour.id as tourId', 'vehicle.company as companyId'])
		.executeTakeFirst();

	await sendNotifications(notificationParams!.companyId, {
		tourId: notificationParams!.tourId,
		pickupTime: r.best.scheduledPickupTimeEnd,
		wheelchairs: capacities.wheelchairs,
		vehicleId: r.best.vehicle,
		change: TourChange.BOOKED
	});

	return requestId;
}
