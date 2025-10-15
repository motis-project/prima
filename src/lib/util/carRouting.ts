import { plan, type PlanResponse } from '$lib/openapi';
import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { lngLatToStr } from './lngLatToStr';
import { SECOND } from './time';
import { env } from '$env/dynamic/public';

export const carRouting = (
	from: maplibregl.LngLatLike,
	to: maplibregl.LngLatLike,
	arriveBy: boolean = false,
	time: string = new Date().toISOString()
): Promise<PlanResponse> => {
	return plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		query: {
			time: time,
			fromPlace: lngLatToStr(from),
			toPlace: lngLatToStr(to),
			arriveBy: arriveBy,
			directModes: ['CAR'],
			transitModes: [],
			preTransitModes: [],
			postTransitModes: [],
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			maxDirectTime: MAX_TRAVEL / SECOND,
			detailedTransfers: false
		}
	}).then((d) => d.data!);
};
