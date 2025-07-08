#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';

const parameters = {
	connection1: {
		start: {
			lng: 14.6428691,
			lat: 51.5145164,
			address: 'Schulze-Delitzsch-Straße 19'
		},
		target: {
			lng: 14.524831,
			lat: 51.5417871,
			address: 'Hoyerswerdaer Straße 50'
		},
		startTime: 1752373376001,
		targetTime: 1752380722712,
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
