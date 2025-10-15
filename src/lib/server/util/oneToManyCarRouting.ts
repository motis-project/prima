import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { oneToMany, type Duration } from '$lib/openapi';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { SECOND, secondToMilli } from '$lib/util/time';
import maplibregl from 'maplibre-gl';
import { env } from '$env/dynamic/public';

function lngLatToStr(pos: maplibregl.LngLatLike) {
	const p = maplibregl.LngLat.convert(pos);
	return `${p.lat};${p.lng}`;
}

export const oneToManyCarRouting = async (
	one: maplibregl.LngLatLike,
	many: maplibregl.LngLatLike[],
	arriveBy: boolean,
	maxDuration?: number
): Promise<(number | undefined)[]> => {
	return await oneToMany({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: {
			one: lngLatToStr(one),
			many: many.map(lngLatToStr),
			max: maxDuration === undefined ? MAX_TRAVEL / SECOND : maxDuration,
			maxMatchingDistance: MAX_MATCHING_DISTANCE,
			mode: 'CAR',
			arriveBy
		}
	}).then((res) => {
		return (
			res.data?.map((d: Duration, i) => {
				console.log(
					'ROUTING: ',
					lngLatToStr(one),
					lngLatToStr(many[i]),
					new Date(secondToMilli(d.duration ?? 0)).toISOString(),
					secondToMilli(d.duration ?? 0)
				);
				return d.duration != undefined && d.duration != null
					? secondToMilli(d.duration)
					: undefined;
			}) || []
		);
	});
};
