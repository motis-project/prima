import { getRoute } from '$lib/api';
import { TZ } from '$lib/constants';
import { db } from '$lib/database';
import { sql } from 'kysely';

/* eslint-disable */
const calculateDistance = (segment: number[][]) => {
	const R = 6371; // Radius of the Earth in kilometers
	const [lon1, lat1] = segment[0];
	const [lon2, lat2] = segment[1];

	// Convert degrees to radians
	const toRadians = (degrees: number) => degrees * (Math.PI / 180);
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // Distance in kilometers
};

const getLines = (route: Route) => {
	const points: [number, number][] = [];
	route.features.forEach((feature: { geometry: { coordinates: [number, number][] } }) => {
		points.push(feature.geometry.coordinates[0]);
	});
	const lines: number[][][] = [];
	for (let i = 0; i < points.length - 1; i++) {
		lines.push([points[i], points[i + 1]]);
	}
	return lines;
};
/* eslint-enable */

type Route = { features: { geometry: { coordinates: [number, number][] } }[] };

type SimpleEvent = {
	latitude: number;
	longitude: number;
	scheduled_time: Date | null;
};

type Leg = {
	start: SimpleEvent;
	destination: SimpleEvent;
};

type Segment = {
	dist: number;
	rate: number;
	flat: boolean;
};

type Rates = {
	base: number;
	steps: number[][];
};

const getRouteSegment = async (leg: Leg) => {
	return await getRoute({
		start: {
			lat: leg.start.latitude,
			lng: leg.start.longitude,
			level: 0
		},
		destination: {
			lat: leg.destination.latitude,
			lng: leg.destination.longitude,
			level: 0
		},
		profile: 'car',
		direction: 'forward'
	});
};

const isWithinNightTime = (isoTimestampUTC: string, startHour: number, endHour: number) => {
	const timestamp = new Date(isoTimestampUTC); // GMT + 0 on server
	const localDateTime = new Date(timestamp.toLocaleString('en', { timeZone: TZ }));
	return localDateTime.getHours() >= startHour || localDateTime.getHours() < endHour;
};

/* eslint-disable-next-line */
const getRates = (ratesJson: any, key: string): Rates => {
	let steps = [[0, 0]];
	let base = 0;
	if (ratesJson[key]['pkm'].length > 0) {
		// rate per km
		base = ratesJson[key]['grundpreis'];
		steps = ratesJson[key]['pkm'];
	} else if (ratesJson[key]['pauschal'].length > 0) {
		// pauschale
		steps = ratesJson[key]['pauschal'];
	}
	return { base: base, steps: steps };
};

const getSegments = async (rates: Rates, leg: Leg): Promise<Segment[]> => {
	/* eslint-disable-next-line */
	let segments: Array<Segment> = [];
	const route_leg = await getRouteSegment(leg);
	let dist = Math.floor(route_leg.metadata.distance);
	if (rates.base === 0) {
		// pauschal
		let rate = rates.steps[0][1];
		for (let i = 1; i <= rates.steps.length - 1; ++i) {
			if (rates.steps[i][0] < dist) {
				rate = rates.steps[i][1];
			}
		}
		segments.push({ dist: dist, rate: rate, flat: true });
	} else {
		// segmenting leg
		if (rates.steps.length === 1) {
			// constant rate
			segments.push({ dist: dist, rate: rates.steps[0][1], flat: false });
		} else {
			for (let i = 0; i < rates.steps.length - 1; ++i) {
				const diff = rates.steps[i + 1][0] - rates.steps[i][0];
				const rate = rates.steps[i][1];
				let d = diff;
				if (dist - d < 0) {
					d = dist;
				}
				dist -= d;
				segments.push({ dist: d, rate: rate, flat: false });
				if (dist === 0) {
					break;
				}
			}
		}
	}
	return segments;
};

export const getFareEstimation = async (
	start: SimpleEvent,
	destination: SimpleEvent,
	vehicleId: number
): Promise<number> => {
	const vehicle = await db
		.selectFrom('vehicle')
		.where('vehicle.id', '=', vehicleId)
		.innerJoin('company', 'company.id', 'vehicle.company')
		.select(['community_area', 'zone', 'latitude', 'longitude'])
		.executeTakeFirst();

	if (vehicle == null) {
		throw new Error('Invalid vehicle ID');
	}
	if (vehicle.latitude == null || vehicle.longitude == null) {
		throw new Error('Cannot get company coordinates for vehicle');
	}
	if (vehicle.community_area == null) {
		throw new Error('Cannot get community ID for vehicle');
	}
	if (vehicle.zone == null) {
		throw new Error('Cannot get zone ID for vehicle');
	}

	const companyLatitude = vehicle.latitude;
	const companyLongitude = vehicle.longitude;
	const communityId = vehicle.community_area;
	const zoneId = vehicle.zone;
	let totalFare = 0;

	console.log('communityZoneId =', communityId);
	console.log('zoneId =', zoneId);

	const zoneRates = await db
		.selectFrom('zone')
		.where('zone.id', '=', zoneId)
		.innerJoin('taxi_rates', 'taxi_rates.id', 'zone.rates')
		.select('taxi_rates.rates')
		.executeTakeFirst();
	if (!zoneRates) {
		throw new Error('Cannot get taxi rates for vehicle');
	}

	const startCommunity = await db
		.selectFrom('zone')
		.where('id', '=', communityId)
		.where(
			sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${start.longitude}, ${start.latitude}),4326))`
		)
		.selectAll()
		.executeTakeFirst();

	const dstCommunity = await db
		.selectFrom('zone')
		.where('id', '=', communityId)
		.where(
			sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${destination.longitude}, ${destination.latitude}),4326))`
		)
		.selectAll()
		.executeTakeFirst();

	/* eslint-disable-next-line */
	let segments: Array<Segment> = [];
	const ratesJson = JSON.parse(zoneRates.rates);
	const returnFree = dstCommunity != null && ratesJson['anfahrt']['return-free'];

	//
	// console.log(
	// 	await db.selectFrom('zone as zone1')
	// 		.where('zone1.is_community', '=', false)
	// 		.innerJoin((eb) => eb.selectFrom('zone')
	// 			.where('zone.is_community', '=', false)
	// 			.selectAll()
	// 			.as('zone2'),
	// 			(join) => join.onTrue()
	// 		)
	// 		.where(
	// 			sql<boolean>`ST_Intersects(zone1.area, zone2.area)`
	// 		)
	// 		.where((eb) => eb.and([eb('zone1.id', '!=', eb.ref('zone2.id'))]))
	// 		.select(['zone1.name as name1', 'zone2.name as name2',
	// 			sql<string>`ST_AsGeoJSON(ST_Intersection(zone1.area, zone2.area))`.as('intersection')])
	// 		.execute()
	// );
	//

	if (startCommunity == null && !returnFree) {
		const rates = getRates(ratesJson, 'anfahrt');
		const leg = {
			start: {
				latitude: companyLatitude,
				longitude: companyLongitude,
				scheduled_time: null
			},
			destination: {
				latitude: start.latitude,
				longitude: start.longitude,
				scheduled_time: null
			}
		};
		const segments_ = await getSegments(rates, leg);

		console.log('Anfahrt:', segments_);
	}

	if (start.scheduled_time == null) {
		throw new Error('No start time was defned');
	}
	if (
		isWithinNightTime(
			start.scheduled_time.toISOString(),
			ratesJson['beginn-nacht'],
			ratesJson['ende-nacht']
		)
	) {
		// nighttime rate
		const rates = getRates(ratesJson, 'nacht');
		totalFare += rates.base;
		const leg = {
			start: start,
			destination: destination
		};
		const segments_ = await getSegments(rates, leg);
		segments = segments.concat(segments_);
		console.log('Nacht-Tarif:', segments_);
	} else {
		// daytime rate
		const rates = getRates(ratesJson, 'tag');
		totalFare += rates.base;
		const leg = {
			start: start,
			destination: destination
		};
		const segments_ = await getSegments(rates, leg);
		segments = segments.concat(segments_);
		console.log('Tag-Tarif:', segments_);
	}

	let totalDist = 0;
	segments.forEach((e) => {
		totalDist += e.dist;
		if (e.flat) {
			totalFare += e.rate;
		} else {
			totalFare += e.dist * e.rate;
		}
	});
	console.log('Distance =', totalDist);

	return Math.round(totalFare / 1000);
};
