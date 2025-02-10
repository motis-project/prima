import { plan, type PlanResponse } from '$lib/openapi';
import { MAX_TRAVEL } from '$lib/constants';
import { lngLatToStr } from './lngLatToStr';
import { SECOND } from './time';
import { PUBLIC_MOTIS_URL } from '$env/static/public';

export const carRouting = (
	from: maplibregl.LngLatLike,
	to: maplibregl.LngLatLike
): Promise<PlanResponse> => {
	return plan({
		baseUrl: PUBLIC_MOTIS_URL,
		query: {
			fromPlace: lngLatToStr(from),
			toPlace: lngLatToStr(to),
			directModes: ['CAR'],
			transitModes: [],
			maxDirectTime: MAX_TRAVEL / SECOND,
			detailedTransfers: false
		}
	}).then((d) => d.data!);
};
