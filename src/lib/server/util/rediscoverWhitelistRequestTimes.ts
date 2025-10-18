import { DIRECT_FREQUENCY, MOTIS_SHIFT } from '$lib/constants';
import type { Leg } from '$lib/openapi';
import { isRideShareLeg } from '$lib/util/booking/checkLegType';

export function rediscoverWhitelistRequestTimes(
	startFixed: boolean,
	isDirect: boolean,
	firstOdmIndex: number,
	lastOdmIndex: number,
	legs: Leg[]
) {
	let requestedTime1 = -1;
	let requestedTime2 = -1;
	if (isDirect) {
		const firstOdm = legs[firstOdmIndex];
		const date = new Date(firstOdm.scheduledStartTime);
		const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
		if (startFixed) {
			requestedTime1 =
				midnight +
				Math.floor(
					(new Date(firstOdm.scheduledStartTime).getTime() - midnight) / DIRECT_FREQUENCY
				) *
					DIRECT_FREQUENCY;
		} else {
			requestedTime1 =
				midnight +
				Math.floor((new Date(firstOdm.scheduledEndTime).getTime() - midnight) / DIRECT_FREQUENCY) *
					(DIRECT_FREQUENCY + 1);
		}
	} else {
		const legAdjacentToOdm =
			firstOdmIndex === 0
				? legs.find((l) => l.mode !== 'WALK' && !isRideShareLeg(l))
				: legs.findLast((l) => l.mode !== 'WALK' && !isRideShareLeg(l));
		requestedTime1 =
			firstOdmIndex === 0
				? new Date(legAdjacentToOdm!.scheduledStartTime).getTime() - MOTIS_SHIFT
				: new Date(legAdjacentToOdm!.scheduledEndTime).getTime() + MOTIS_SHIFT;
		if (firstOdmIndex !== lastOdmIndex) {
			const legBeforeOdm = legs.findLast((l) => l.mode !== 'WALK' && !isRideShareLeg(l));
			requestedTime2 = new Date(legBeforeOdm!.scheduledStartTime).getTime();
		}
	}
	return { requestedTime1, requestedTime2 };
}
