import { login, LoginInto } from '$lib/server/auth/login';
import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
	return await login(event, LoginInto.PRIMA_DRIVER);
};

export const GET = async () => {
	return redirect(303, '/account/ui-login');
};
