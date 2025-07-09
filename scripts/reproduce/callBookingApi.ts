#!/usr/bin/env ts-node

import 'dotenv/config';
import { bookingApi } from '../../src/lib/server/booking/bookingApi';

const parameters = {
	connection1: {
		start: {
			lng: 14.587021,
			lat: 51.3572526,
			address: 'Körnerplatz'
		},
		target: {
			lng: 14.5141138,
			lat: 51.5332486,
			address: 'Mühlweg 5b'
		},
		startTime: 1752393161218,
		targetTime: 1752396617220,
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
