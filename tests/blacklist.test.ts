import { page } from '$app/stores';
import { blacklisting, type BookingRequestParameters } from '$lib/api';
import { Coordinates } from '$lib/location';
import { expect, test } from '@playwright/test';

test('busStops and timeStamps length do not match', async ({ request, page }) => {
	page.on('console', msg => console.log(msg.text()));
	const r: BookingRequestParameters = {
		userChosen: new Coordinates(51.03485947001579, 13.293447066879821),
		busStops: [],
		startFixed: true,
		timeStamps: [],
		numPassengers: 1,
		numWheelchairs: 0,
		numBikes: 0,
		luggage: 0
	};
	console.log(r);
	const res = await request.fetch('/api/blacklisting', {
		method: 'POST',
		data: {body: JSON.stringify({
			r
		})}
	});
	//console.log(res);
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
