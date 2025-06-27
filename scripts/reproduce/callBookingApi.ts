#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';

const parameters = {
	connection1: {
		start: {
			lng: 14.7548758,
			lat: 51.5010823,
			address: 'Brandstraße 9'
		},
		target: {
			lng: 14.5289849,
			lat: 51.5353088,
			address: 'Siedlung - Sydlišćo'
		},
		startTime: 1751216212673,
		targetTime: 1751219410160,
		signature: '',
		startFixed: true
	},
	connection2: null,
	capacities: {
		passengers: 1,
		bikes: 0,
		luggage: 0,
		wheelchairs: 0
	}
};

const kidsThreeToFour = 0;
const kidsZeroToTwo = 0;
const kidsFiveToSix = 0;
const finalFlag = true;
async function main() {
	const response = await bookingApi(
		parameters,
		1,
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
