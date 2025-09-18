import { cancelTour } from '$lib/server/cancelTour';
import type { RequestEvent } from './$types';
import { json } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
	const company = event.locals.session!.companyId;
	const p = await event.request.json();
	console.log(
		'Cancel Tour PARAMS START: ',
		JSON.stringify(p, null, '\t'),
		{ company },
		'Cancel Tour PARAMS END'
	);
	if (!company || !p.tourId || p.message == null || p.message == undefined) {
		console.log('Cancel Tour early exit - invalid params tourId: ', p.tour);
		return json({});
	}
	return json(cancelTour(p.tourId, p.message, company));
};
