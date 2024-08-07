import type { PageServerLoad } from './$types.js';
import { db } from '$lib/database';
import { TZ } from '$lib/constants.js';
import { mapTourEvents } from '../../(user)/taxi/TourDetails.js';

export const load: PageServerLoad = async () => {
	const utcDate = new Date(new Date().toLocaleString('en', { timeZone: TZ }));

	const tours = mapTourEvents(
		await db
			.selectFrom('event')
			.innerJoin('tour', 'tour.id', 'event.tour')
			.where((eb) => eb.and([eb('tour.arrival', '<', utcDate)]))
			.innerJoin('address', 'address.id', 'event.address')
			.innerJoin('auth_user', 'auth_user.id', 'event.customer')
			.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
			.innerJoin('company', 'company.id', 'vehicle.company')
			.orderBy('event.scheduled_time')
			.selectAll('event')
			.selectAll('address')
			.selectAll('auth_user')
			.selectAll('tour')
			.selectAll('vehicle')
			.select([
				'company.name as company_name',
				'company.address as company_address',
				'company.zone as company_zone',
				'company.community_area as company_community_area',
				'company.latitude as company_lat',
				'company.longitude as company_long'
			])
			.execute()
	);

	return {
		tours
	};
};
