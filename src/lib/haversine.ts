import type { Position } from 'geojson';
import { type Coordinates } from './util/Coordinates';

function toRad(deg: number) {
	return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
	return (rad * 180) / Math.PI;
}

const R = 6371000; // Earth radius in meters

export function haversineDistance(c1: Coordinates, c2: Coordinates) {
	const dLat = toRad(c2.lat - c1.lat);
	const dLon = toRad(c2.lng - c1.lng);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

export function haversineDestination(
	source: Position,
	distance: number,
	bearing: number
): Position {
	const latSourceRad = toRad(source[1]);
	const bearingRad = toRad(bearing);
	const sinLatSource = Math.sin(latSourceRad);
	const cosLatSource = Math.cos(latSourceRad);
	const angularDistance = distance / R;
	const sinAngularDistance = Math.sin(angularDistance);
	const cosAngularDistance = Math.cos(angularDistance);
	const latDestRad = Math.asin(
		sinLatSource * cosAngularDistance + cosLatSource * sinAngularDistance * Math.cos(bearingRad)
	);
	const lonDestRad =
		toRad(source[0]) +
		Math.atan2(
			Math.sin(bearingRad) * sinAngularDistance * cosLatSource,
			cosAngularDistance - sinLatSource * Math.sin(latDestRad)
		);

	return [toDeg(lonDestRad), toDeg(latDestRad)];
}
