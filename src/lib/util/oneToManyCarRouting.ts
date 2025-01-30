import { MAX_MATCHING_DISTANCE, MAX_TRAVEL, MOTIS_BASE_URL } from '$lib/constants';
import { oneToMany, type Duration } from '$lib/openapi';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { SECOND, secondToMilli } from './time';
import maplibregl from 'maplibre-gl';

function lngLatToStr(pos: maplibregl.LngLatLike) {
	const p = maplibregl.LngLat.convert(pos);
	return `${p.lat};${p.lng}`;
}

export const oneToManyCarRouting = async (
	one: maplibregl.LngLatLike,
	many: maplibregl.LngLatLike[],
	arriveBy: boolean
): Promise<number[]> => {
	return await oneToMany({
		baseUrl: MOTIS_BASE_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: {
			one: lngLatToStr(one),
			many: many.map(lngLatToStr),
			max: MAX_TRAVEL / SECOND,
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			mode: 'CAR',
			arriveBy
		}
	}).then((res) => {
		return res.data!.map((d: Duration) => {
			return secondToMilli(d.duration ?? Number.MAX_VALUE);
		});
	});
};
