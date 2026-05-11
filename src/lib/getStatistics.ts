import { db } from '$lib/server/db/index.js';

async function getTours(type: 'tour' | 'rideShareTour') {
	return await db
		.selectFrom(type)
		.where(`${type}.approachAndReturnM`, 'is not', null)
		.where(`${type}.approachAndReturnDrivingMs`, 'is not', null)
		.where(`${type}.approachAndReturnWaitingMs`, 'is not', null)
		.select([
			'cancelled',
			'approachAndReturnM',
			'approachAndReturnDrivingMs',
			'approachAndReturnWaitingMs',
			'fullyPayedM',
			'fullyPayedDrivingMs',
			'fullyPayedWaitingMs',
			'occupiedM',
			'occupiedDrivingMs',
			'occupiedWaitingMs',
			'cumulatedPassengerM',
			'cumulatedPassengerDrivingMs',
			'cumulatedPassengerWaitingMs',
			'totalM',
			'totalDrivingMs',
			'totalWaitingMs'
		])
		.execute();
}

async function getRequests(type: 'taxi' | 'rideShareTour') {
	const condition = type === 'taxi' ? 'is not' : 'is';
	return await db
		.selectFrom('request')
		.where('request.publicTransportDistance', 'is not', null)
		.where('request.publicTransportDurationMs', 'is not', null)
		.where('request.tour', condition, null)
		.select(['cancelled', 'publicTransportDistance', 'publicTransportDurationMs', 'passengers'])
		.execute();
}

type Tours = Awaited<ReturnType<typeof getTours>>;
type Requests = Awaited<ReturnType<typeof getRequests>>;

export async function viewStatistics() {
	const tours = await getTours('tour');
	const tourEntries = {
		'stornierte Touren': createTourEntries(tours.filter((t) => t.cancelled)),
		'gefahrene touren': createTourEntries(tours.filter((t) => !t.cancelled))
	};

	const rsTours = await getTours('rideShareTour');
	const rsTourEntries = {
		'stornierte Mitfahrten': createTourEntries(rsTours.filter((t) => t.cancelled)),
		'gefahrene Mitfahrten': createTourEntries(rsTours.filter((t) => !t.cancelled))
	};

	const requests = await getRequests('rideShareTour');
	const requestEntries = {
		'stornierte Buchungen': createRequestEntries(requests.filter((r) => r.cancelled)),
		'gefahrene Buchungen': createRequestEntries(requests.filter((r) => !r.cancelled))
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
		count: tours.length,
		'Anfahrt/Rückfahrt m': tours.reduce((prev, curr) => (prev += curr.approachAndReturnM!), 0),
		'Anfahrt/Rückfahrt driving ms': tours.reduce(
			(prev, curr) => (prev += curr.approachAndReturnDrivingMs!),
			0
		),
		'Anfahrt/Rückfahrt waiting ms': tours.reduce(
			(prev, curr) => (prev += curr.approachAndReturnWaitingMs!),
			0
		),
		'voll bezahlte Distanz m': tours.reduce((prev, curr) => (prev += curr.fullyPayedM!), 0),
		'voll bezahlte Fahrtzeit ms': tours.reduce(
			(prev, curr) => (prev += curr.fullyPayedDrivingMs!),
			0
		),
		'voll bezahlte Wartezeit ms': tours.reduce(
			(prev, curr) => (prev += curr.fullyPayedWaitingMs!),
			0
		),
		'Distanz mit Passagier m': tours.reduce((prev, curr) => (prev += curr.occupiedM!), 0),
		'Fahrtzeit mit Passagier ms': tours.reduce(
			(prev, curr) => (prev += curr.occupiedDrivingMs!),
			0
		),
		'Wartezeit mit Passagier ms': tours.reduce(
			(prev, curr) => (prev += curr.occupiedWaitingMs!),
			0
		),
		'kumulierte Passagier Distanz m': tours.reduce(
			(prev, curr) => (prev += curr.cumulatedPassengerM!),
			0
		),
		'kumulierte Passagier Fahrtzeit ms': tours.reduce(
			(prev, curr) => (prev += curr.cumulatedPassengerDrivingMs!),
			0
		),
		'kumulierte Passagier Wartezeit ms': tours.reduce(
			(prev, curr) => (prev += curr.cumulatedPassengerWaitingMs!),
			0
		),
		'Totale Distanz m': tours.reduce((prev, curr) => (prev += curr.totalM!), 0),
		'Totale Fahrtzeit ms': tours.reduce((prev, curr) => (prev += curr.totalDrivingMs!), 0),
		'Totale Wartezeit ms': tours.reduce((prev, curr) => (prev += curr.totalWaitingMs!), 0)
	};
}

function createRequestEntries(requests: Requests) {
	return {
		Anzahl: requests.length,
		'ÖPNV Distanz m': requests.reduce((prev, curr) => (prev += curr.publicTransportDistance!), 0),
		'ÖPNV Zeit ms': requests.reduce((prev, curr) => (prev += curr.publicTransportDurationMs!), 0),
		'kumulierte Passagier ÖPNV Distanz m': requests.reduce(
			(prev, curr) => (prev += curr.publicTransportDistance! * curr.passengers),
			0
		),
		'kumulierte Passagier Zeit ms': requests.reduce(
			(prev, curr) => (prev += curr.publicTransportDurationMs! * curr.passengers),
			0
		)
	};
}
