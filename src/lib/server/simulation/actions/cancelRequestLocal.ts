import { cancelRequest } from '$lib/server/db/cancelRequest';
import { getToursWithRequests } from '$lib/server/db/getTours';
import { DAY } from '$lib/util/time';
import { randomInt } from '../randomInt';
import type { ActionResponse } from '../simulation';

export async function cancelRequestLocal(customerId: number): Promise<ActionResponse> {
	const requests = (await getToursWithRequests(false)).flatMap((t) =>
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
	await cancelRequest(requests[r].requestId, customerId);
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
