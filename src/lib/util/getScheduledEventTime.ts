import type { UnixtimeMs } from './UnixtimeMs';

export function getScheduledEventTime(ev: {
	isPickup: boolean;
	scheduledTimeEnd: UnixtimeMs;
	scheduledTimeStart: UnixtimeMs;
}): UnixtimeMs {
	return ev.isPickup ? ev.scheduledTimeEnd : ev.scheduledTimeStart;
}

export function getOuterScheduledEventTime(ev: {
	isPickup: boolean;
	scheduledTimeEnd: UnixtimeMs;
	scheduledTimeStart: UnixtimeMs;
}): UnixtimeMs {
	return ev.isPickup ? ev.scheduledTimeStart : ev.scheduledTimeEnd;
}
