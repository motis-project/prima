import { ALTERABLE_HORIZON } from '$lib/constants';
import { addAutomaticAvailability } from '$lib/server/addAutomaticAvailability';
import { Interval } from '$lib/util/interval';
import { DAY } from '$lib/util/time';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (_: RequestEvent) => {
	const todayMidnight = new Date();
	todayMidnight.setUTCHours(0, 0, 0, 0);
	const startTime = todayMidnight.getTime() + ALTERABLE_HORIZON;
	const inserted = await addAutomaticAvailability(new Interval(startTime, startTime + DAY));

	console.log(`Added ${inserted} automatic availability intervals for ${new Date(startTime)}.`);
	return json({ inserted });
};
