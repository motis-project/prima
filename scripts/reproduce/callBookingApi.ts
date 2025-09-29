#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/taxi/bookingApi';

const parameters = {
	capacities: {
		passengers: 1,
		bikes: 0,
		luggage: 0,
		wheelchairs: 0
	},
	connection1: {
		start: {
			lat: 51.505444,
			lng: 14.638026999999997,
			address: 'Weißwasser Bahnhof'
		},
		target: {
			lat: 51.4417032,
			lng: 14.6895141,
			address: 'Körnerplatz'
		},
		startTime: 1754619540000,
		targetTime: 1754621400000,
		signature: 'cf9dcc63e0c95aacc17524783c750f35f3af63e9b607cdd3e25121d3db430632',
		startFixed: true,
		requestedTime: 1754609100000
	},
	connection2: null
};

const kidsThreeToFour = 0;
const kidsZeroToTwo = 0;
const kidsFiveToSix = 0;
const finalFlag = false;
async function main() {
	const response = await bookingApi(
		parameters,
		1,
		false,
		true,
		kidsThreeToFour,
		kidsFiveToSix,
		kidsZeroToTwo,
		finalFlag
	);

	if (response.status === 200) {
		console.log('Booking succeeded');
	}
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
