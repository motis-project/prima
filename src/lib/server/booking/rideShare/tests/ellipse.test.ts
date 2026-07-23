import { addTestUser, clearDatabase } from '$lib/testHelpers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSession } from '$lib/server/auth/session';
import { inXMinutes } from '$lib/server/booking/testUtils';
import { Interval } from '$lib/util/interval';
import { createRideShareVehicle } from '../createRideShareVehicle';
import { addRideShareTour } from '../addRideShareTour';
import { getRideShareTours, getRideShareToursFiltered } from '../getRideShareTours';
import { isPointInPreparedDetourEllipse, prepareDetourEllipse } from '$lib/util/booking/ellipse';
import { SCHEDULED_TIME_BUFFER_DROPOFF_RELATIVE } from '$lib/constants';

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const weisswasserWest = { lat: 51.50717128906919, lng: 14.622989053100525 };
const weisswasserEast = { lat: 51.50412563855747, lng: 14.635632731583911 };
const weisswasserMiddle = {
	lat: (weisswasserWest.lat + weisswasserEast.lat) / 2,
	lng: (weisswasserWest.lng + weisswasserEast.lng) / 2
};
const dueben = { lat: 51.57081851189798, lng: 14.614068743138432 };
const goerlitz = { lat: 51.152079, lng: 14.987212 };
const cottbus = { lat: 51.75631, lng: 14.332867 };
const dresden = { lat: 51.050409, lng: 13.737262 };

let mockUserId = -1;

beforeAll(async () => {
	await clearDatabase();
}, 60000);

beforeEach(async () => {
	await clearDatabase();
	mockUserId = (await addTestUser()).id;
	await createSession('generateSessionToken()', mockUserId);
});

async function addRideShareTourFromTo(
	start: { lat: number; lng: number },
	target: { lat: number; lng: number },
	licensePlate: string,
	minutesFromNow = 100
) {
	const vehicle = await createRideShareVehicle(
		mockUserId,
		0,
		3,
		'',
		'',
		false,
		licensePlate,
		null,
		'DE'
	);

	const tourId = await addRideShareTour(
		[inXMinutes(minutesFromNow)],
		true,
		3,
		0,
		mockUserId,
		vehicle,
		start,
		target
	);

	expect(tourId).not.toBeUndefined();
	return tourId;
}

async function addWeisswasserRideShareTour(licensePlate: string) {
	return await addRideShareTourFromTo(weisswasserWest, weisswasserEast, licensePlate);
}

function storedEllipseFromTour(tour: Awaited<ReturnType<typeof getRideShareTours>>[0]) {
	return {
		originLatRad: tour.originLatRad!,
		originLngRad: tour.originLngRad!,
		cosOriginLat: tour.cosOriginLat!,
		centerX: tour.centerX!,
		centerY: tour.centerY!,
		axisXx: tour.axisXx!,
		axisXy: tour.axisXy!,
		axisYx: tour.axisYx!,
		axisYy: tour.axisYy!,
		invAaSq: tour.invAaSq!,
		invBbSq: tour.invBbSq!,
		minX: tour.minX!,
		minY: tour.minY!,
		maxX: tour.maxX!,
		maxY: tour.maxY!,
		pointOnly: tour.pointOnly!
	};
}

function pointAround(origin: { lat: number; lng: number }, distanceMeters: number, angle: number) {
	const earthRadiusM = 6371000;
	return {
		lat: origin.lat + ((distanceMeters * Math.sin(angle)) / earthRadiusM) * (180 / Math.PI),
		lng:
			origin.lng +
			((distanceMeters * Math.cos(angle)) /
				(earthRadiusM * Math.cos((origin.lat * Math.PI) / 180))) *
				(180 / Math.PI)
	};
}

describe('ride share detour ellipse', () => {
	it('contains random points near both foci', () => {
		const routeDistanceMeters = 60_000;
		const extraDistanceMeters = routeDistanceMeters * SCHEDULED_TIME_BUFFER_DROPOFF_RELATIVE * 1.15;
		const guaranteedRadiusMeters = extraDistanceMeters / 2;
		const ellipse = prepareDetourEllipse(weisswasserWest, goerlitz, routeDistanceMeters);

		for (const focus of [weisswasserWest, goerlitz]) {
			for (let i = 0; i < 100; i++) {
				const angle = Math.random() * 2 * Math.PI;
				const distance = Math.sqrt(Math.random()) * guaranteedRadiusMeters * 0.99;
				expect(isPointInPreparedDetourEllipse(ellipse, pointAround(focus, distance, angle))).toBe(
					true
				);
			}
		}
	});

	it('stores a prepared ellipse and checks points inside and outside it', async () => {
		await addWeisswasserRideShareTour('lp1');

		const [tour] = await getRideShareTours(
			capacities,
			new Interval(inXMinutes(0), inXMinutes(600))
		);
		expect(tour).toBeDefined();
		expect(tour.axisXx).not.toBeNull();

		const ellipse = storedEllipseFromTour(tour);

		expect(isPointInPreparedDetourEllipse(ellipse, weisswasserWest)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, weisswasserMiddle)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, weisswasserEast)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, dueben)).toBe(false);
	});

	it('filters ride share tours by start and target ellipse matches', async () => {
		const tourId = await addWeisswasserRideShareTour('lp2');
		const searchInterval = new Interval(inXMinutes(0), inXMinutes(600));

		const matchingTours = await getRideShareToursFiltered(
			capacities,
			searchInterval,
			weisswasserWest,
			[dueben, weisswasserEast]
		);
		expect(matchingTours.map((t) => t.rideShareTour)).toEqual([tourId]);

		const outsideStartTours = await getRideShareToursFiltered(capacities, searchInterval, dueben, [
			weisswasserEast
		]);
		expect(outsideStartTours).toHaveLength(0);

		const outsideTargetTours = await getRideShareToursFiltered(
			capacities,
			searchInterval,
			weisswasserWest,
			[dueben]
		);
		expect(outsideTargetTours).toHaveLength(0);
	});

	it('stores a prepared ellipse for a longer ride share tour', async () => {
		await addRideShareTourFromTo(weisswasserWest, goerlitz, 'lp3');

		const [tour] = await getRideShareTours(
			capacities,
			new Interval(inXMinutes(0), inXMinutes(600))
		);
		expect(tour).toBeDefined();
		expect(tour.axisXx).not.toBeNull();

		const weisswasserToGoerlitzMiddle = {
			lat: (weisswasserWest.lat + goerlitz.lat) / 2,
			lng: (weisswasserWest.lng + goerlitz.lng) / 2
		};
		const ellipse = storedEllipseFromTour(tour);

		expect(isPointInPreparedDetourEllipse(ellipse, weisswasserWest)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, weisswasserToGoerlitzMiddle)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, goerlitz)).toBe(true);
		expect(isPointInPreparedDetourEllipse(ellipse, cottbus)).toBe(false);
	});

	it('filters multiple longer ride share tours in one search', async () => {
		const goerlitzTourId = await addRideShareTourFromTo(weisswasserWest, goerlitz, 'lp4', 100);
		const cottbusTourId = await addRideShareTourFromTo(weisswasserWest, cottbus, 'lp5', 180);
		const searchInterval = new Interval(inXMinutes(0), inXMinutes(600));

		const matchingTours = await getRideShareToursFiltered(
			capacities,
			searchInterval,
			weisswasserWest,
			[goerlitz, cottbus]
		);
		expect(matchingTours.map((t) => t.rideShareTour).sort()).toEqual(
			[goerlitzTourId, cottbusTourId].sort()
		);

		const goerlitzOnlyTours = await getRideShareToursFiltered(
			capacities,
			searchInterval,
			weisswasserWest,
			[goerlitz]
		);
		expect(goerlitzOnlyTours.map((t) => t.rideShareTour)).toEqual([goerlitzTourId]);

		const outsideStartTours = await getRideShareToursFiltered(capacities, searchInterval, dresden, [
			goerlitz,
			cottbus
		]);
		expect(outsideStartTours).toHaveLength(0);
	});
});
