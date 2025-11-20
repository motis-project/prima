import { rideShareApi } from '../../src/lib/server/booking';

const parameters = {
	capacities: {
		passengers: 2,
		bikes: 0,
		luggage: 0,
		wheelchairs: 0
	},
	connection1: {
		start: {
			lat: 51.505442,
			lng: 14.638026999999997,
			address: 'Weißwasser Bahnhof'
		},
		target: {
			lat: 51.4804411,
			lng: 14.7708978,
			address: 'Feuerlöschteich 4'
		},
		startTime: 1761456300000,
		targetTime: 1761458160000,
		signature: '043d3df015b5e08882f15fc83d2930582db6d51c9cc7a3544b07c38e1945dcf6',
		startFixed: true,
		requestedTime: 1761438000000,
		mode: 1
	},
	connection2: null
};

const kidsThreeToFour = 0;
const kidsZeroToTwo = 0;
const kidsFiveToSix = 0;
const finalFlag = undefined;

async function main() {
	const response = await rideShareApi(
		parameters,
		1,
		true,
		kidsThreeToFour,
		kidsFiveToSix,
		kidsZeroToTwo,
		finalFlag
	);

	if (response !== undefined) {
		console.log('Adding ride share tour succeeded');
	}
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
