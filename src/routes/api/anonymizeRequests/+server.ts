import type { RequestEvent } from './$types';
import { INTERNAL_API_TOKEN } from '$env/static/private';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sql } from 'kysely';
import { anonymousId, anonymousPrecision } from '$lib/constants';
import { TIME_TO_ANONYMIZATION } from '$lib/util/time';

export const POST = async (event: RequestEvent) => {
	const token = event.request.headers.get('internal-token');
	if (token !== INTERNAL_API_TOKEN) {
		console.log('Unauthorized access of anonymizeRequests endpoint');
		error(403);
	}
	const anonymizationTimestamp = Date.now() - TIME_TO_ANONYMIZATION;
	await db
		.updateTable('request')
		.set({ customer: anonymousId })
		.from('tour')
		.whereRef('tour.id', '=', 'request.tour')
		.where('tour.arrival', '<', anonymizationTimestamp)
		.execute();

	await db
		.updateTable('event')
		.set({
			lat: sql<number>`event.lat + (RANDOM() * ${anonymousPrecision})`,
			lng: sql<number>`event.lng + (RANDOM() * ${anonymousPrecision})`
		})
		.from('request')
		.innerJoin('tour', 'request.tour', 'tour.id')
		.whereRef('event.request', '=', 'request.id')
		.where('tour.arrival', '<', anonymizationTimestamp)
		.execute();

	await db
		.updateTable('journey')
		.set({
			json: null
		})
		.from('request')
		.where((eb) =>
			eb.or([
				eb('journey.request1', '=', eb.ref('request.id')),
				eb('journey.request2', '=', eb.ref('request.id'))
			])
		)
		.innerJoin('tour', 'tour.id', 'request.tour')
		.where('tour.arrival', '<', anonymizationTimestamp)
		.execute();

	return json({});
};
