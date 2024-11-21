import polyline from '@mapbox/polyline';

export function polylineToGeoJSON(encodedPolyline: string): GeoJSON.LineString {
	const coordinates = polyline.decode(encodedPolyline, 7).map(([lng, lat]) => [lat, lng]);
	return {
		type: 'LineString',
		coordinates
	};
}
