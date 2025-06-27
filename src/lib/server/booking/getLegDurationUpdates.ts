import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { oneToManyCarRouting } from '../util/oneToManyCarRouting';
import type { Event } from '$lib/server/booking/getBookingAvailability';

export async function getLegDurationUpdates(firstEvents: Event[], lastEvents: Event[]) {
	const prevLegDurations: { event: number; duration: number | null }[] = [];
	const nextLegDurations: { event: number; duration: number | null }[] = [];
	const routing = firstEvents.map((e, i) => oneToManyCarRouting(lastEvents[i], [e], false));
	const routingResults = await Promise.all(routing);
	const durations = routingResults.map((r) => (r[0] ? r[0] + PASSENGER_CHANGE_DURATION : null));
	durations.forEach((d, i) =>
		prevLegDurations.push({
			event: firstEvents[i].id,
			duration: d
		})
	);
	durations.forEach((d, i) =>
		nextLegDurations.push({
			event: lastEvents[i].id,
			duration: d
		})
	);
	return { prevLegDurations, nextLegDurations };
}
