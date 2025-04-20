import type { Coordinates } from '$lib/util/Coordinates';
import { InsertHow } from './insertionTypes';
import { v4 as uuidv4 } from 'uuid';
import { isSamePlace } from '$lib/util/booking/isSamePlace';
import { type Event } from '$lib/server/booking/getBookingAvailability';

export type EventGroupUpdate = {
	id: number;
	event_group: string;
};

export const getEventGroupInfo = (
	events: Event[],
	coordinates: Coordinates,
	prevEventIdx: number | undefined,
	nextEventIdx: number | undefined,
	how: InsertHow
): {
	newEventGroup: string;
	updateList: EventGroupUpdate[];
} => {
	let newEventGroup: string;
	if (how == InsertHow.NEW_TOUR) {
		newEventGroup = uuidv4();
	} else {
		const prevEvent = prevEventIdx == undefined ? undefined : events[prevEventIdx];
		const nextEvent = nextEventIdx == undefined ? undefined : events[nextEventIdx];
		const comparisonEvent = how == InsertHow.PREPEND ? nextEvent : prevEvent;
		if (comparisonEvent == undefined) {
			console.log('Internal Error, comparisonEvent was undefined in getEventGroupInfo.');
			return {
				newEventGroup: uuidv4(),
				updateList: new Array<EventGroupUpdate>()
			};
		}
		newEventGroup = !isSamePlace(comparisonEvent, coordinates)
			? uuidv4()
			: comparisonEvent.eventGroup;
	}
	return {
		newEventGroup,
		updateList: getEventGroupUpdates(events, coordinates, nextEventIdx, how, newEventGroup)
	};
};

const getEventGroupUpdates = (
	events: Event[],
	coordinates: Coordinates,
	nextEventIdx: number | undefined,
	how: InsertHow,
	newEventGroup: string
): EventGroupUpdate[] => {
	const updateList: EventGroupUpdate[] = new Array<EventGroupUpdate>();
	if (how != InsertHow.CONNECT || nextEventIdx == undefined) {
		return updateList;
	}
	const nextEvent = events[nextEventIdx];
	const nextTour = nextEvent!.tourId;
	for (let i = nextEventIdx; i != events.length; ++i) {
		if (nextTour != events[i].tourId || !isSamePlace(events[i], coordinates)) {
			break;
		}
		updateList.push({
			id: events[i].id,
			event_group: newEventGroup
		});
	}
	return updateList;
};
