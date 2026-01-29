import { db } from '../src/lib/server/db/index.js';

async function getTours() {
	return await db
		.selectFrom('tour')
		.where('tour.approachAndReturnM', 'is not', null)
		.selectAll()
		.execute();
}

async function getRsTours() {
	return await db
		.selectFrom('rideShareTour')
		.where('rideShareTour.approachAndReturnM', 'is not', null)
		.selectAll()
		.execute();
}

type Tours = Awaited<ReturnType<typeof getTours>>;
type RsTours = Awaited<ReturnType<typeof getRsTours>>;

async function viewStatistics() {
	const tours = await getTours();
	const tourEntries = {
		all: createEntries(tours),
		cancelled: createEntries(tours.filter((t) => t.cancelled)),
		uncancelledTours: createEntries(tours.filter((t) => !t.cancelled))
	};

	const rsTours = await getRsTours();
	const rsTourEntries = {
		all: createRsEntries(rsTours),
		cancelled: createRsEntries(rsTours.filter((t) => t.cancelled)),
		uncancelledTours: createRsEntries(rsTours.filter((t) => !t.cancelled))
	};
	console.log('TAXI');
	console.log(JSON.stringify(tourEntries, null, 2));
	console.log();
	console.log('RIDE SHARE');
	console.log(JSON.stringify(rsTourEntries, null, 2));
}

function createEntries(tours: Tours) {
	return {
		count: tours.length,
		approachAndReturnM: tours.reduce((prev, curr) => (prev += curr.approachAndReturnM!), 0),
		fullyPayedM: tours.reduce((prev, curr) => (prev += curr.fullyPayedM!), 0),
		occupiedM: tours.reduce((prev, curr) => (prev += curr.occupiedM!), 0)
	};
}

function createRsEntries(tours: RsTours) {
	return {
		count: tours.length,
		approachAndReturnM: tours.reduce((prev, curr) => (prev += curr.approachAndReturnM!), 0),
		fullyPayedM: tours.reduce((prev, curr) => (prev += curr.fullyPayedM!), 0),
		occupiedM: tours.reduce((prev, curr) => (prev += curr.occupiedM!), 0)
	};
}

viewStatistics().catch((error) => {
	console.error('Error in main function:', error);
});
