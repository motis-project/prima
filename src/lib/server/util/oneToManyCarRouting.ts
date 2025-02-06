import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { oneToMany, type Duration } from '$lib/openapi';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { SECOND, secondToMilli } from '../../util/time';
import maplibregl from 'maplibre-gl';
import { PUBLIC_MOTIS_URL } from '$env/static/public';

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
		baseUrl: PUBLIC_MOTIS_URL,
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
		return res.data!.map((d: Duration, i) => {
			console.log(
				'ROUTING: ',
				lngLatToStr(one),
				lngLatToStr(many[i]),
				new Date(secondToMilli(d.duration ?? 0)).toISOString()
			);
			return secondToMilli(d.duration ?? Number.MAX_VALUE);
		});
	});
};
