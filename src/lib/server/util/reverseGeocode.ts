import { reverseGeocode } from '$lib/openapi';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { env } from '$env/dynamic/public';
import type { Coordinates } from '$lib/util/Coordinates';

export const reverseGeo = async (place: Coordinates): Promise<string> => {
	const result = await reverseGeocode({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: {
			place: `${place.lat},${place.lng}`
		}
	});
	return result.data ? result.data[0].name : '';
};
