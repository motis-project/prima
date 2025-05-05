import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';

export const PUT = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const deviceId = url.searchParams.get('deviceId');
	const token = url.searchParams.get('token');

	if (deviceId == null || token == null) {
		error(400, { message: 'Invalid deviceId or token parameter' });
	}

	await db
		.insertInto('fcmToken')
		.values({ deviceId: deviceId, company: companyId, fcmToken: token })
		.onConflict((oc) => oc.columns(['deviceId', 'company']).doUpdateSet({ fcmToken: token }))
		.execute();

	return new Response(null, { status: 204 });
};
