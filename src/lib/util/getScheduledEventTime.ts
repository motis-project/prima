export function getScheduledEventTime(ev: {
	isPickup: boolean;
	scheduledTimeEnd: number;
	scheduledTimeStart: number;
}) {
	return ev.isPickup ? ev.scheduledTimeEnd : ev.scheduledTimeStart;
}
