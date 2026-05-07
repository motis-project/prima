import { db } from '$lib/server/db/index.js';

async function getTours(type: 'tour' | 'rideShareTour') {
	return await db
		.selectFrom(type)
		.where(`${type}.approachAndReturnM`, 'is not', null)
		.select([
			'cancelled',
			'approachAndReturnM',
			'fullyPayedM',
			'occupiedM',
			'cumulatedPassengerM',
			'totalM'
		])
		.execute();
}

async function getRequests(type: 'taxi' | 'rideShareTour') {
	const condition = type === 'taxi' ? 'is not' : 'is';
	return await db
		.selectFrom('request')
		.where('request.publicTransportDistance', 'is not', null)
		.where('request.tour', condition, null)
		.select(['cancelled', 'publicTransportDistance', 'passengers'])
		.execute();
}

type Tours = Awaited<ReturnType<typeof getTours>>;
type Requests = Awaited<ReturnType<typeof getRequests>>;

export async function viewStatistics() {
	const tours = await getTours('tour');
	const tourEntries = {
		cancelled: createTourEntries(tours.filter((t) => t.cancelled)),
		uncancelledTours: createTourEntries(tours.filter((t) => !t.cancelled))
	};

	const rsTours = await getTours('rideShareTour');
	const rsTourEntries = {
		cancelled: createTourEntries(rsTours.filter((t) => t.cancelled)),
		uncancelledTours: createTourEntries(rsTours.filter((t) => !t.cancelled))
	};

	const requests = await getRequests('rideShareTour');
	const requestEntries = {
		cancelled: createRequestEntries(requests.filter((r) => r.cancelled)),
		uncancelled: createRequestEntries(requests.filter((r) => !r.cancelled))
	};

	const rideShareRequests = await getRequests('taxi');
	const rsRequestEntries = {
		cancelled: createRequestEntries(rideShareRequests.filter((r) => r.cancelled)),
		uncancelled: createRequestEntries(rideShareRequests.filter((r) => !r.cancelled))
	};
	console.log('TAXI');
	console.log(JSON.stringify(tourEntries, null, 2));
	console.log();
	console.log('RIDE SHARE');
	console.log(JSON.stringify(rsTourEntries, null, 2));
	return { tourEntries, rsTourEntries, requestEntries, rsRequestEntries };
}

function createTourEntries(tours: Tours) {
	return {
		Count: tours.length,
		'Approach/return m': tours.reduce((prev, curr) => (prev += curr.approachAndReturnM!), 0),
		'Fully paid m': tours.reduce((prev, curr) => (prev += curr.fullyPayedM!), 0),
		'Occupied m': tours.reduce((prev, curr) => (prev += curr.occupiedM!), 0),
		'Passenger m': tours.reduce((prev, curr) => (prev += curr.cumulatedPassengerM!), 0),
		'Total m': tours.reduce((prev, curr) => (prev += curr.totalM!), 0)
	};
}

function createRequestEntries(requests: Requests) {
	return {
		Count: requests.length,
		'Public transport m': requests.reduce(
			(prev, curr) => (prev += curr.publicTransportDistance!),
			0
		),
		'Per Passenger Public transport m': requests.reduce(
			(prev, curr) => (prev += curr.publicTransportDistance! * curr.passengers),
			0
		)
	};
}
