import { plan, type PlanResponse } from '$lib/openapi';
import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { lngLatToStr } from './lngLatToStr';
import { SECOND } from './time';
import { env } from '$env/dynamic/public';

export const carRouting = (
	from: maplibregl.LngLatLike,
	to: maplibregl.LngLatLike
): Promise<PlanResponse> => {
	return plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		query: {
			fromPlace: lngLatToStr(from),
			toPlace: lngLatToStr(to),
			directModes: ['CAR'],
			transitModes: [],
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			maxDirectTime: MAX_TRAVEL / SECOND,
			detailedTransfers: false
		}
	}).then((d) => d.data!);
};
