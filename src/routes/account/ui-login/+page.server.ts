import type { Actions, PageServerLoadEvent, RequestEvent } from './$types';
import { login, LoginInto } from '$lib/server/auth/login';

export function load(event: PageServerLoadEvent) {
	return {
		passwordResetSuccess: event.url.searchParams.has('passwordResetSuccess')
	};
}

export const actions: Actions = {
	default: async (event: RequestEvent) => {
		return await login(event, LoginInto.PRIMA_MAIN);
	}
};
