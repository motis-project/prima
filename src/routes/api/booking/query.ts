import type { ExpectedConnection } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/server/booking/Capacities';
import type { DirectDrivingDurations } from '$lib/server/booking/getDirectDrivingDurations';
import type { EventGroupUpdate } from '$lib/server/booking/getEventGroupInfo';
import type { Insertion, NeighbourIds } from '$lib/server/booking/insertion';
import type { Database } from '$lib/server/db';
import { sql, Transaction } from 'kysely';

export async function insertRequest(
  connection: Insertion,
  capacities: Capacities,
  c: ExpectedConnection,
  customer: number,
  updateEventGroupList: EventGroupUpdate[],
  mergeTourList: number[],
  startEventGroup: string,
  targetEventGroup: string,
  neighbourIds: NeighbourIds,
  direct: DirectDrivingDurations,
  trx: Transaction<Database>
) {
  mergeTourList = mergeTourList.filter((id) => id != connection.tour);
  const approachDurations = new Array<{ id: number; approach_duration: number }>();
  if (neighbourIds.nextDropoff != neighbourIds.nextPickup && neighbourIds.nextPickup) {
    approachDurations.push({
      id: neighbourIds.nextPickup,
      approach_duration: connection.pickupNextLegDuration
    });
  }
  if (neighbourIds.nextDropoff) {
    approachDurations.push({
      id: neighbourIds.nextDropoff,
      approach_duration: connection.dropoffNextLegDuration
    });
  }

  const returnDurations = new Array<{ id: number; return_duration: number }>();
  if (neighbourIds.prevPickup) {
    returnDurations.push({
      id: neighbourIds.prevPickup,
      return_duration: connection.pickupPrevLegDuration
    });
  }
  if (neighbourIds.prevDropoff != neighbourIds.prevPickup && neighbourIds.prevDropoff) {
    returnDurations.push({
      id: neighbourIds.prevDropoff,
      return_duration: connection.dropoffPrevLegDuration
    });
  }
  await sql`
        CALL create_and_merge_tours(
            ROW(${capacities.passengers}, ${capacities.wheelchairs}, ${capacities.bikes}, ${capacities.luggage}, ${customer}),
            ROW(${true}, ${c.start.lat}, ${c.start.lng}, ${connection.pickupTime}, ${connection.pickupTime}, ${connection.pickupTime}, ${connection.pickupPrevLegDuration}, ${connection.pickupNextLegDuration}, ${c.start.address}, ${startEventGroup}),
            ROW(${false}, ${c.target.lat}, ${c.target.lng}, ${connection.dropoffTime}, ${connection.dropoffTime}, ${connection.dropoffTime}, ${connection.dropoffPrevLegDuration}, ${connection.dropoffNextLegDuration}, ${c.target.address}, ${targetEventGroup}),
            ${mergeTourList},
            ROW(${connection.departure}, ${connection.arrival}, ${connection.vehicle}, ${direct.thisTour?.directDrivingDuration ?? null}, ${connection.tour}),
            ${JSON.stringify(updateEventGroupList)}::jsonb,
            ${JSON.stringify(returnDurations)}::jsonb,
            ${JSON.stringify(approachDurations)}::jsonb,
            ROW(${direct.nextTour?.tourId ?? null}, ${direct.nextTour?.directDrivingDuration ?? null}),
            ROW(${direct.thisTour?.tourId ?? null}, ${direct.thisTour?.directDrivingDuration ?? null})
        )`.execute(trx);
}
//TODOS:
// communicated/scheduled times
