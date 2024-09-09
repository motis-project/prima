import { Interval } from '$lib/interval.js';
import { MAX_TRAVEL_DURATION, SEARCH_INTERVAL_SIZE } from '$lib/constants.js';

export const computeSearchIntervals = (
	startFixed: boolean,
	times: Date[][],
	travelDuration: number
): {
	startTimes: Interval;
	searchInterval: Interval;
	expandedSearchInterval: Interval;
} => {
	const time = times.flatMap((t) => t)[0];
	const possibleStartTimes = new Interval(
		startFixed ? time : new Date(time.getTime() - SEARCH_INTERVAL_SIZE - travelDuration),
		startFixed
			? new Date(time.getTime() + SEARCH_INTERVAL_SIZE)
			: new Date(time.getTime() - travelDuration)
	);
	const searchInterval = possibleStartTimes.expand(0, travelDuration);
	const expandedSearchInterval = searchInterval.expand(MAX_TRAVEL_DURATION, MAX_TRAVEL_DURATION);
	return {
		startTimes: possibleStartTimes,
		searchInterval,
		expandedSearchInterval
	};
};
