import { addRideShareTour } from '../../src/lib/server/booking';

const params = {
	time: 1,
	startFixed: true,
	passengers: 1,
	luggage: 0,
	provider: 1,
	vehicle: 1,
	start: { lat: 1, lng: 1 },
	target: { lat: 1, lng: 1 },
	startAddress: '',
	targetAddress: ''
};

async function main() {
	const response = await addRideShareTour(
		params.time,
		params.startFixed,
		params.passengers,
		params.luggage,
		params.provider,
		params.vehicle,
		params.start,
		params.target,
		params.startAddress,
		params.targetAddress
	);

	if (response !== undefined) {
		console.log('Adding ride share tour succeeded');
	}
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
