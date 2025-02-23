export function getScheduledEventTime(ev: {
	isPickup: boolean;
	scheduledTimeEnd: number;
	scheduledTimeStart: number;
}) {
	return ev.isPickup ? ev.scheduledTimeEnd : ev.scheduledTimeStart;
}

export function getEventLatestTime(ev: {
	communicatedTime: number;
	scheduledTimeEnd: number;
	scheduledTimeStart: number;
}) {
	return Math.max(...[ev.scheduledTimeStart, ev.scheduledTimeEnd, ev.communicatedTime]);
}
