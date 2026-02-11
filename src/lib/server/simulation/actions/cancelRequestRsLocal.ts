import { cancelRideShareRequest } from '$lib/server/booking/rideShare/cancelRideShareRequest';
import { getRideShareTours } from '$lib/server/util/getRideShareTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function cancelRequestRsLocal() {
	const requests = (await getRideShareTours(false, undefined, false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	await cancelRideShareRequest(requests[r].requestId, 1);
	return {
		vehicleId: requests[r].vehicleId,
		dayStart: Math.floor(requests[r].startTime / DAY) * DAY
	};
}
