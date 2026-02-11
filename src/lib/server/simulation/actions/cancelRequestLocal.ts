import { cancelRequest } from '$lib/server/db/cancelRequest';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';

export async function cancelRequestLocal() {
	const requests = (await getToursWithRequests(false)).flatMap((t) =>
		t.requests.map((r) => {
			return { ...t, ...r };
		})
	);
	if (requests.length === 0) {
		return false;
	}
	const r = randomInt(0, requests.length);
	await cancelRequest(requests[r].requestId, requests[r].companyId);
	return {
		vehicleId: requests[r].vehicleId,
		dayStart: Math.floor(requests[r].startTime / DAY) * DAY
	};
}
