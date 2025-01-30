import { client } from '$lib/openapi';
import { browser } from '$app/environment';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';

if (browser) {
	const params = new URL(window.location.href).searchParams;
	const defaultProtocol = 'https:';
	const defaultHost = 'api.transitous.org';
	const defaultPort = '443';
	const motisParam = params.get('motis');
	let baseUrl = String(defaultProtocol + '//' + defaultHost + ':' + defaultPort);
	if (motisParam) {
		if (/^[0-9]+$/.test(motisParam)) {
			baseUrl = defaultProtocol + '//' + defaultHost + ':' + motisParam;
		} else if (!motisParam.includes(':')) {
			baseUrl = defaultProtocol + '//' + motisParam + ':' + defaultPort;
		} else if (!motisParam.startsWith('http:') && !motisParam.startsWith('https:')) {
			baseUrl = defaultProtocol + '//' + motisParam;
		} else {
			baseUrl = motisParam;
		}
	}
	const querySerializer = { array: { explode: false } } as QuerySerializerOptions;
	client.setConfig({ baseUrl, querySerializer });
}
