import type { RequestEvent } from '@sveltejs/kit';

export const getIp = (event: RequestEvent) => {
	try {
		return event.request.headers.get('X-Forwarded-For') ?? event.getClientAddress();
	} catch {
		return '';
	}
};
