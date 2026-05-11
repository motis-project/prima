import type { Coordinates } from './util/Coordinates';

export function haversineDistance(c1: Coordinates, c2: Coordinates) {
	function toRad(deg: number) {
		return (deg * Math.PI) / 180;
	}
	const R = 6371000; // Earth radius in meters

	const dLat = toRad(c2.lat - c1.lat);
	const dLon = toRad(c2.lng - c1.lng);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}
