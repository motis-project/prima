import Prom from 'prom-client';
import type { RequestEvent } from './$types';

export const GET = async (event: RequestEvent) => {
	return new Response(await Prom.register.metrics(), { status: 200 });
};
