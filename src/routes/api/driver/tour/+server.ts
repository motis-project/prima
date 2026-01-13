import { v4 as uuidv4 } from 'uuid';
import { isSamePlace } from '$lib/util/booking/isSamePlace';
import { getTours } from '$lib/server/db/getTours';
import { readInt } from '$lib/server/util/readForm.js';
import type { TourEvent, Tour, Tours } from '$lib/util/getToursTypes';
import { error, json } from '@sveltejs/kit';

export const GET = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const fromTime = readInt(url.searchParams.get('fromTime'));
	const toTime = readInt(url.searchParams.get('toTime'));

	if (isNaN(fromTime) || isNaN(toTime)) {
		error(400, { message: 'Invalid time range' });
	}
	return json(updateEventGroups(await getTours(true, companyId, [fromTime, toTime])));
};

function updateEventGroups(tours: Tours) {
	const toursWithEventGroups = new Array<Tour>(tours.length);
	for (const [tIdx, tour] of tours.entries()) {
		const events = tour.events;
		const eventsWithEventGroups = new Array<TourEvent & { eventGroup: string }>(events.length);
		let uuid = uuidv4();
		if (events.length != 0) {
			eventsWithEventGroups[0] = {
				...events[0],
				eventGroup: uuid
			};
		}
		for (let eIdx = 1; eIdx != events.length; ++eIdx) {
			if (!isSamePlace(events[eIdx - 1], events[eIdx])) {
				uuid = uuidv4();
			}
			eventsWithEventGroups[eIdx] = {
				...events[eIdx],
				eventGroup: uuid
			};
		}
		toursWithEventGroups[tIdx] = {
			...tour,
			events: eventsWithEventGroups
		};
	}
	return toursWithEventGroups;
}
