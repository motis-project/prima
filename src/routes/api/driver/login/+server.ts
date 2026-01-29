import { login, LoginInto } from '$lib/server/auth/login';
import type { RequestEvent } from './$types';

export const POST = async (event: RequestEvent) => {
	await login(event, LoginInto.PRIMA_DRIVER);
};
