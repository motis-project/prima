import { plan, type Itinerary } from '$lib/openapi';
import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { lngLatToStr } from './lngLatToStr';
import { SECOND, secondToMilli } from './time';
import { env } from '$env/dynamic/public';

export const carRouting = (
	from: maplibregl.LngLatLike,
	to: maplibregl.LngLatLike,
	arriveBy: boolean = false, // does not invert from/to!
	time: string = new Date().toISOString(),
	maxDirectTime: number = MAX_TRAVEL
): Promise<Itinerary | undefined> => {
	return plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		query: {
			time,
			fromPlace: lngLatToStr(from),
			toPlace: lngLatToStr(to),
			arriveBy: arriveBy,
			directModes: ['CAR'],
			transitModes: [],
			preTransitModes: [],
			postTransitModes: [],
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			maxDirectTime: maxDirectTime / SECOND,
			detailedTransfers: false
		}
	}).then((res) => {
		const d = res.data?.direct[0];
		console.log(
			'ROUTING 1:1: ',
			lngLatToStr(from),
			lngLatToStr(to),
			new Date(secondToMilli(d?.duration ?? 0)).toISOString(),
			secondToMilli(d?.duration ?? 0)
		);
		if (d?.duration) {
			d.duration = secondToMilli(d.duration);
		}
		return d;
	});
};
