import { getRideShareTourCommunicatedTimes } from '$lib/server/booking';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
	const q = await event.request.json();
	const response = await getRideShareTourCommunicatedTimes(
		q.time,
		q.startFixed,
		q.vehicle,
		q.start,
		q.end
	); //TODO check correct user?
	if (response === undefined) {
		return json({});
	}
	return json(response);
};
