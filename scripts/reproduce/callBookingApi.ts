#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';

const parameters = {
	connection1: {
		start: {
			lng: 14.6265431,
			lat: 51.336027,
			address: 'Körnerplatz'
		},
		target: {
			lng: 14.537528,
			lat: 51.5418744,
			address: 'Friedensstraße 77a'
		},
		startTime: 1752390941953,
		targetTime: 1752397720765,
		signature: '',
		startFixed: true
	},
	connection2: null,
	capacities: {
		passengers: 2,
		bikes: 0,
		luggage: 0,
		wheelchairs: 0
	}
};

const kidsThreeToFour = 0;
const kidsZeroToTwo = 0;
const kidsFiveToSix = 0;
const finalFlag = false;
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
