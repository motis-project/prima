import polyline from '@mapbox/polyline';

export function polylineToGeoJSON(encodedPolyline: string): GeoJSON.LineString {
	return {
		type: 'LineString',
		coordinates: polyline
			.decode(encodedPolyline, 7) //
			.map(([lng, lat]) => [lat, lng])
	};
}
