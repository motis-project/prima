import type { Coordinates } from './location';
import polyline from '@mapbox/polyline';

export const coordinatesToStr = (c: Coordinates) => {
	return `${c.lat};${c.lng}`;
};

export const coordinatesToPlace = (c: Coordinates) => {
	return `${c.lat},${c.lng},0`;
};

export function polylineToGeoJSON(encodedPolyline: string): GeoJSON.LineString {
	const coordinates = polyline.decode(encodedPolyline, 7).map(([lng, lat]) => [lat, lng]);
	return {
		type: 'LineString',
		coordinates
	};
}

