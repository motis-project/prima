import { moveTour } from '$lib/server/moveTour';
import { json } from '@sveltejs/kit';

export const POST = async (event) => {
	const companyId = event.locals.session?.companyId;
	if (!companyId) {
		throw 'no company id';
	}
	const request = event.request;
	const { tourId, vehicleId } = await request.json();
	console.log(
		'MOVE TOUR PARAMS START: ',
		JSON.stringify({ tourId, vehicleId, companyId }, null, '\t'),
		'MOVE TOUR PARAMS END'
	);
	return json(await moveTour(tourId, vehicleId, companyId));
};
