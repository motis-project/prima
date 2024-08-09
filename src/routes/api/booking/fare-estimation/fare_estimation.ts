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

const getRouteSegment = async (
	start: { latitude: number; longitude: number },
	destination: { latitude: number; longitude: number }
) => {
	return await getRoute({
		start: {
			lat: start.latitude,
			lng: start.longitude,
			level: 0
		},
		destination: {
			lat: destination.latitude,
			lng: destination.longitude,
			level: 0
		},
		profile: 'car',
		direction: 'forward'
	});
};

const getSegmentFare = async (
	start: { latitude: number; longitude: number },
	dst: { latitude: number; longitude: number },
	rate_km: number,
	rate_time: number
) => {
	const route = await getRouteSegment(start, dst);
	if (!route) {
		throw new Error('getSegmentFare: Could not get route');
	}
	const dist = route.metadata.distance / 1000;
	// const duration = route.metadata.duration / 3600;
	const waitTime = 0;
	const distFare = dist * rate_km;
	const timeFare = waitTime * rate_time;
	return Math.round(distFare + timeFare);
};

const isTimestampInRange = (isoTimestampUTC: string, startHour: number, endHour: number) => {
	const timestamp = new Date(isoTimestampUTC); // GMT + 0 on server
	const localDateTime = new Date(timestamp.toLocaleString('en', { timeZone: TZ }));
	return localDateTime.getHours() >= startHour || localDateTime.getHours() < endHour;
};

export const getFareEstimation = async (
	start: { latitude: number; longitude: number; scheduled_time: Date },
	destination: { latitude: number; longitude: number },
	vehicleId: number
): Promise<number> => {
	const zone = await db
		.selectFrom('zone')
		.where((eb) =>
			eb.and([
				eb('zone.is_community', '=', true),
				sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${start.longitude}, ${start.latitude}),4326))`
			])
		)
		.innerJoin('taxi_rates', 'taxi_rates.id', 'zone.rates')
		.select(['zone.id', 'taxi_rates.rates'])
		.executeTakeFirst();
	if (!zone) {
		throw new Error('Zuordnung Taxi-Unternehmen -> Gemeinde fehlgeschlagen.');
	}
	const compulsory_area = await db
		.selectFrom('zone')
		.where('id', '=', zone.id)
		.innerJoin('taxi_rates', 'taxi_rates.id', 'taxi_rates.rates')
		.select('taxi_rates.rates')
		.executeTakeFirst();
	if (!compulsory_area) {
		throw new Error('Zuordnung Taxi-Unternehmen -> Pflichtfahrgebiet fehlgeschlagen.');
	}

	const ratesJson = JSON.parse(compulsory_area.rates);
	let totalFare = ratesJson['grundpreis'];

	const vehicle = await db
		.selectFrom('vehicle')
		.where('vehicle.id', '=', vehicleId)
		.innerJoin('company', 'company.id', 'vehicle.company')
		.select(['community_area', 'latitude', 'longitude'])
		.executeTakeFirst();
	if (!vehicle) {
		throw new Error();
	}

	if (zone.id != vehicle.community_area) {
		// rate for journey to first pickup
		console.log('Not within comunity');
		if (vehicle.latitude == null || vehicle.longitude == null) {
			throw new Error();
		}
		totalFare += await getSegmentFare(
			{ latitude: vehicle.latitude, longitude: vehicle.longitude },
			start,
			ratesJson['anfahrt-pkm'],
			ratesJson['wartezeit-ph']
		);
	}

	if (
		isTimestampInRange(
			start.scheduled_time.toISOString(),
			ratesJson['beginn-nacht'],
			ratesJson['ende-nacht']
		)
	) {
		// nighttime rate
		totalFare += await getSegmentFare(start, destination, ratesJson['ts3-pkm'], ratesJson['wartezeit-ph']);
		console.log('Nighttime rate');
	} else {
		// daytime rate
		totalFare += await getSegmentFare(start, destination, ratesJson['ts2-pkm'], ratesJson['wartezeit-ph']);
	}

	return totalFare;
};
