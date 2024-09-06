import { db } from '$lib/database';

export const queryCompletedTours = async (companyId: number | undefined) => {
	return await db
		.selectFrom('event')
		.innerJoin('tour', 'tour.id', 'event.tour')
		.where((eb) => eb.and([eb('tour.arrival', '<', new Date())]))
		.innerJoin('address', 'address.id', 'event.address')
		.innerJoin('auth_user', 'auth_user.id', 'event.customer')
		.innerJoin('vehicle', 'vehicle.id', 'tour.vehicle')
		.innerJoin('company', 'company.id', 'vehicle.company')
		.$if(companyId != undefined, (qb) => qb.where('company', '=', companyId!))
		.orderBy('event.scheduled_time')
		.selectAll(['event', 'address', 'tour', 'vehicle'])
		.select([
			'company.name as company_name',
			'company.address as company_address',
			'auth_user.first_name as customer_first_name',
			'auth_user.last_name as customer_last_ame',
			'auth_user.phone as customer_phone'
		])
		.execute();
};
