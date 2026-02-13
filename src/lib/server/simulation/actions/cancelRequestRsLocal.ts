import { cancelRideShareRequest } from '$lib/server/booking/rideShare/cancelRideShareRequest';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';

export async function cancelRequestRsLocal(): Promise<ActionResponse> {
	const requests = (await getRideShareTours(false, undefined, false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return {
			lastActionSpecifics: null,
			success: false,
			error: false,
			atomicDurations: {} as Record<string, number>
		};
	}
	const r = randomInt(0, requests.length - 1);
	await cancelRideShareRequest(requests[r].requestId, 1);
	return {
		lastActionSpecifics: {
			vehicleId: requests[r].vehicleId,
			dayStart: Math.floor(requests[r].startTime / DAY) * DAY
		},
		success: true,
		error: false,
		atomicDurations: {} as Record<string, number>
	};
}
