import { client } from '$lib/openapi';
import { browser } from '$app/environment';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { env } from '$env/dynamic/public';

if (browser) {
	const querySerializer = { array: { explode: false } } as QuerySerializerOptions;
	client.setConfig({ baseUrl: env.PUBLIC_MOTIS_URL, querySerializer });
}
