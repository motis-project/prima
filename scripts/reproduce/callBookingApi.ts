#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';

const parameters = {
	connection1: {
		start: {
			lng: 14.5235396,
			lat: 51.4047924,
			address: 'Körnerplatz'
		},
		target: {
			lng: 14.5297765,
			lat: 51.5435594,
			address: 'Alter Postweg 11'
		},
		startTime: 1752152334312,
		targetTime: 1752154107310,
		signature: '',
		startFixed: false
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
