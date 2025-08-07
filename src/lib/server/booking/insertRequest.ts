import type { ExpectedConnection } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import type { DirectDrivingDurations } from '$lib/server/booking/getDirectDrivingDurations';
import type { Insertion, NeighbourIds } from '$lib/server/booking/insertion';
import { type Database } from '$lib/server/db';
import { sql, Transaction } from 'kysely';
import { sendNotifications } from '$lib/server/firebase/notifications';
import { TourChange } from '$lib/server/firebase/firebase';
import type { ScheduledTimes } from './getScheduledTimes';
import { legOdmPrice } from '$lib/util/odmPrice';

export async function insertRequest(
	connection: Insertion,
	capacities: Capacities,
	c: ExpectedConnection,
	customer: number,
	mergeTourList: number[],
	neighbourIds: NeighbourIds,
	direct: DirectDrivingDurations,
	prevLegDurations: { event: number; duration: number | null }[],
	nextLegDurations: { event: number; duration: number | null }[],
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	kidsSevenToFourteen: number,
	scheduledTimes: ScheduledTimes,
	trx: Transaction<Database>
): Promise<number> {
	mergeTourList = mergeTourList.filter((id) => id != connection.tour);
	if (neighbourIds.nextDropoff != neighbourIds.nextPickup && neighbourIds.nextPickup) {
		prevLegDurations.push({
			event: neighbourIds.nextPickup,
			duration: connection.pickupNextLegDuration
		});
	}
	if (neighbourIds.nextDropoff) {
		prevLegDurations.push({
			event: neighbourIds.nextDropoff,
			duration: connection.dropoffNextLegDuration
		});
	}

	if (neighbourIds.prevPickup) {
		nextLegDurations.push({
			event: neighbourIds.prevPickup,
			duration: connection.pickupPrevLegDuration
		});
	}
	if (neighbourIds.prevDropoff != neighbourIds.prevPickup && neighbourIds.prevDropoff) {
		nextLegDurations.push({
			event: neighbourIds.prevDropoff,
			duration: connection.dropoffPrevLegDuration
		});
	}

	const ticketPrice = legOdmPrice(
		capacities.passengers,
		kidsZeroToTwo + kidsThreeToFour + kidsFiveToSix,
		kidsSevenToFourteen
	);
	const requestId = (
		await sql<{ request: number }>`
        SELECT create_and_merge_tours(
            ROW(${capacities.passengers}, ${kidsZeroToTwo}, ${kidsThreeToFour}, ${kidsFiveToSix}, ${capacities.wheelchairs}, ${capacities.bikes}, ${capacities.luggage}, ${customer}, ${ticketPrice}),
            ROW(${true}, ${c.start.lat}, ${c.start.lng}, ${connection.pickupTime}, ${connection.scheduledPickupTime}, ${connection.pickupTime}, ${connection.pickupPrevLegDuration}, ${connection.pickupNextLegDuration}, ${c.start.address}, ${''}),
            ROW(${false}, ${c.target.lat}, ${c.target.lng}, ${connection.scheduledDropoffTime}, ${connection.dropoffTime}, ${connection.dropoffTime}, ${connection.dropoffPrevLegDuration}, ${connection.dropoffNextLegDuration}, ${c.target.address}, ${''}),
            ${mergeTourList},
            ROW(${connection.departure ?? null}, ${connection.arrival ?? null}, ${connection.vehicle}, ${direct.thisTour?.directDrivingDuration ?? null}, ${connection.tour ?? null}),
            ROW(${direct.nextTour?.tourId ?? null}, ${direct.nextTour?.directDrivingDuration ?? null}),
            ROW(${direct.thisTour?.tourId ?? null}, ${direct.thisTour?.directDrivingDuration ?? null}),
			${JSON.stringify(scheduledTimes.updates)}::jsonb,
			${JSON.stringify(prevLegDurations)}::jsonb,
			${JSON.stringify(nextLegDurations)}::jsonb
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
		pickupTime: connection.pickupTime,
		wheelchairs: capacities.wheelchairs,
		vehicleId: connection.vehicle,
		change: TourChange.BOOKED
	});

	return requestId;
}
