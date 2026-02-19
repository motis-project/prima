import { pushState, replaceState } from '$app/navigation';
import { trip } from '$lib/openapi';

export async function onClickTrip(tripId: string, replace = false) {
	const { data: itinerary, error } = await trip({ query: { tripId } });
	if (error) {
		alert(error);
		return;
	}
	const updateState = replace ? replaceState : pushState;
	updateState('', { selectedItinerary: itinerary });
}

export async function onClickStop(name: string, stopId: string, time: Date, replace = false) {
	const updateState = replace ? replaceState : pushState;
	updateState('', { stop: { name, stopId, time } });
}
