import { client } from '$lib/openapi';
import { browser } from '$app/environment';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { PUBLIC_MOTIS_URL } from '$env/static/public';

if (browser) {
	const querySerializer = { array: { explode: false } } as QuerySerializerOptions;
	client.setConfig({ baseUrl: PUBLIC_MOTIS_URL, querySerializer });
}
