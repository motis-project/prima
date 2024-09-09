import { blacklisting } from '$lib/api';
import { Coordinates } from '$lib/location';
import { expect, test } from '@playwright/test';

test('Set company data, incomplete 1', async ({ request }) => {
	const r = {
		userChosen: new Coordinates(51.03485947001579, 13.293447066879821),
		busStops: [],
		startFixed: true,
		timeStamps: [],
		numPassengers: 1,
		numWheelchairs: 0,
		numBikes: 0,
		luggage: 0
	};
	const res = await blacklisting(r);
	console.log(res);
	expect(res.ok).toBe(false);
});
/*
	userChosen: Coordinates;
	busStops: Coordinates[];
	startFixed: boolean;
	timeStamps: Date[][];
	numPassengers: number;
	numWheelchairs: number;
	numBikes: number;
	luggage: number;
	*/
