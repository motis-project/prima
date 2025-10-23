import { DIRECT_FREQUENCY, MOTIS_SHIFT } from '$lib/constants';
import type { Leg } from '$lib/openapi';
import { isOdmLeg } from '$lib/util/booking/checkLegType';

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
			firstOdmIndex === 0 ? legs.find((l) => !isOdmLeg(l)) : legs.findLast((l) => !isOdmLeg(l));
		console.assert(
			legAdjacentToOdm!.mode === 'WALK',
			`leg adjacent to odm does not have mode WALK ${legAdjacentToOdm}`
		);
		if (legAdjacentToOdm!.duration * 1000 > MOTIS_SHIFT) {
			requestedTime1 =
				firstOdmIndex === 0
					? new Date(legAdjacentToOdm!.scheduledEndTime).getTime()
					: new Date(legAdjacentToOdm!.scheduledStartTime).getTime();
		} else {
			requestedTime1 =
				firstOdmIndex === 0
					? new Date(legAdjacentToOdm!.scheduledStartTime).getTime()
					: new Date(legAdjacentToOdm!.scheduledEndTime).getTime();
		}
		if (firstOdmIndex !== lastOdmIndex) {
			const legBeforeOdm = legs.findLast((l) => !isOdmLeg(l));
			requestedTime2 = new Date(legBeforeOdm!.scheduledStartTime).getTime();
		}
	}
	return { requestedTime1, requestedTime2 };
}
