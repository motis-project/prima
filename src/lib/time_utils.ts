export function secondsToMs(minutes: number) {
	return minutes * 1000;
}

export function minutesToMs(minutes: number) {
	return minutes * 60000;
}

export function hoursToMs(hours: number) {
	return hours * 3600000;
}

export function MsToHours(ms: number) {
	return ms / 3600000;
}
