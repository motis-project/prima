import { plan, type PlanResponse } from '$lib/openapi';
import { MAX_TRAVEL_SECONDS, MOTIS_BASE_URL } from '$lib/constants';
import { lngLatToStr } from './lngLatToStr';

export const carRouting = (
	from: maplibregl.LngLatLike,
	to: maplibregl.LngLatLike
): Promise<PlanResponse> => {
	return plan({
		baseUrl: MOTIS_BASE_URL,
		query: {
			fromPlace: lngLatToStr(from),
			toPlace: lngLatToStr(to),
			directModes: ['CAR'],
			transitModes: [],
			maxDirectTime: MAX_TRAVEL_SECONDS
		}
	}).then((d) => d.data!);
};
