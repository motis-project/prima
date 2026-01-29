import { login, LoginInto } from '$lib/server/auth/login';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
	return json(await login(event, LoginInto.PRIMA_DRIVER));
};
