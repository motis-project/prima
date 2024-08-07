import type { PageServerLoad } from './$types.js';
import { db } from '$lib/database';
import { TZ } from '$lib/constants.js';
import { mapTourEvents } from '../taxi/TourDetails.js';

export const load: PageServerLoad = async (event) => {
	const companyId = event.locals.user?.company;
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
			.where('company', '=', companyId!)
			.orderBy('event.scheduled_time')
			.selectAll(['event', 'address', 'tour', 'vehicle'])
			.select([
				'company.name as company_name',
				'company.address as company_address',
				'auth_user.first_name as customerFirstName',
				'auth_user.last_name as customerLastName',
				'auth_user.phone as customerPhone'
			])
			.execute()
	);

	return {
		tours
	};
};
