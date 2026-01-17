import { MAX_MATCHING_DISTANCE, MAX_TRAVEL } from '$lib/constants';
import { type Duration, type OneToManyResponses } from '$lib/openapi';
import { env } from '$env/dynamic/public';
import { client } from '$lib/openapi/client.gen';
import { SECOND, secondToMilli } from '$lib/util/time';
import maplibregl from 'maplibre-gl';

function lngLatToStr(pos: maplibregl.LngLatLike) {
	const p = maplibregl.LngLat.convert(pos);
	return `${p.lat};${p.lng}`;
}

export const oneToManyCarRouting = async (
	one: maplibregl.LngLatLike,
	many: maplibregl.LngLatLike[],
	arriveBy: boolean,
	maxDuration: number = MAX_TRAVEL
): Promise<(number | undefined)[]> => {
	return await client
		.post<OneToManyResponses, unknown, false>({
			baseUrl: env.PUBLIC_MOTIS_URL,
			url: '/api/v1/one-to-many',
			body: {
				one: lngLatToStr(one),
				many: many.map(lngLatToStr),
				max: maxDuration / SECOND,
				maxMatchingDistance: MAX_MATCHING_DISTANCE,
				mode: 'CAR',
				elevationCosts: 'NONE',
				arriveBy
			}
		})
		.then((res) => {
			return (
				res.data?.map((d: Duration, i) => {
					console.log(
						'ROUTING: ',
						{ one: lngLatToStr(one) },
						{ many: lngLatToStr(many[i]) },
						{ manyToOne: arriveBy },
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
