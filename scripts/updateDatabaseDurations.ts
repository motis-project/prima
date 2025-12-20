import { db } from '../src/lib/server/db/index.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { oneToManyCarRouting } from '../src/lib/server/util/oneToManyCarRouting.js';
import { PASSENGER_CHANGE_DURATION } from '../src/lib/constants.js';
import { groupBy } from '../src/lib/util/groupBy.js';

async function updateDatabaseDurations() {
	await db.transaction().execute(async (trx) => {
		const tours = await trx
			.selectFrom('tour')
			.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
			.innerJoin('company', 'company.id', 'vehicle.company')
			.where('tour.cancelled', '=', false)
			.select((eb) => [
				'tour.id as tourId',
				'company.lat',
				'company.lng',
				'company.id as companyId',
				'vehicle.id as vehicleId',
				jsonArrayFrom(
					eb
						.selectFrom('eventGroup')
						.innerJoin('event', 'event.eventGroupId', 'eventGroup.id')
						.innerJoin('request', 'event.request', 'request.id')
						.select([
							'eventGroup.id as eventGroupId',
							'eventGroup.lat',
							'eventGroup.lng',
							'eventGroup.scheduledTimeStart',
							'eventGroup.scheduledTimeEnd',
							'eventGroup.address'
						])
						.orderBy('eventGroup.scheduledTimeStart asc')
						.whereRef('tour.id', '=', 'request.tour')
						.where('event.cancelled', '=', false)
				).as('eventGroups')
			])
			.orderBy('tour.arrival asc')
			.execute();
		for (const tour of tours) {
			for (let i = 1; i != tour.eventGroups.length; ++i) {
				const earlierEventGroup = tour.eventGroups[i - 1];
				const laterEventGroup = tour.eventGroups[i];
				const duration = (
					await oneToManyCarRouting(earlierEventGroup, [laterEventGroup], false)
				)[0];
				if (duration !== undefined) {
					await trx
						.updateTable('eventGroup')
						.set({ nextLegDuration: duration + PASSENGER_CHANGE_DURATION })
						.where('eventGroup.id', '=', earlierEventGroup.eventGroupId)
						.executeTakeFirst();
					await trx
						.updateTable('eventGroup')
						.set({ prevLegDuration: duration + PASSENGER_CHANGE_DURATION })
						.where('eventGroup.id', '=', laterEventGroup.eventGroupId)
						.executeTakeFirst();
				}
			}
			if (tour.lat && tour.lng) {
				const company = { lat: tour.lat!, lng: tour.lng! };
				const durationFromCompany = (
					await oneToManyCarRouting(company, [tour.eventGroups[0]], false)
				)[0];

				if (durationFromCompany) {
					await trx
						.updateTable('eventGroup')
						.set({ prevLegDuration: durationFromCompany })
						.where('eventGroup.id', '=', tour.eventGroups[0].eventGroupId)
						.executeTakeFirst();
				}
				const durationToCompany = (
					await oneToManyCarRouting(tour.eventGroups[tour.eventGroups.length - 1], [company], false)
				)[0];
				if (durationToCompany) {
					await trx
						.updateTable('eventGroup')
						.set({ nextLegDuration: durationToCompany + PASSENGER_CHANGE_DURATION })
						.where('eventGroup.id', '=', tour.eventGroups[tour.eventGroups.length - 1].eventGroupId)
						.executeTakeFirst();
				}
			} else {
				console.log(
					"Company's latitude or longitude was null! For company with id: ",
					tour.companyId
				);
			}
		}
		const toursByVehicle = groupBy(
			tours,
			(t) => t.vehicleId,
			(t) => t
		);
		for (const [_, toursOfVehicle] of toursByVehicle) {
			for (let i = 1; i != toursOfVehicle.length; ++i) {
				const earlierTour = toursOfVehicle[i - 1];
				const laterTour = toursOfVehicle[i];
				const lastEventEarlierTour = earlierTour.eventGroups[earlierTour.eventGroups.length - 1];
				const firstEventLaterTour = laterTour.eventGroups[0];
				const directDuration = (
					await oneToManyCarRouting(lastEventEarlierTour, [firstEventLaterTour], false)
				)[0];
				if (directDuration) {
					await trx
						.updateTable('tour')
						.set({ directDuration: directDuration + PASSENGER_CHANGE_DURATION })
						.where('tour.id', '=', laterTour.tourId)
						.executeTakeFirst();
				}
			}
		}
	});
}

updateDatabaseDurations().catch((error) => {
	console.error('Error in main function:', error);
});
