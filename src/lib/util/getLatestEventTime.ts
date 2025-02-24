export function getLatestEventTime(ev: {
	communicatedTime: number;
	scheduledTimeEnd: number;
	scheduledTimeStart: number;
}) {
	return Math.max(...[ev.scheduledTimeStart, ev.scheduledTimeEnd, ev.communicatedTime]);
}
