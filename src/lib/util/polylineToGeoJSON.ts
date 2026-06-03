import polyline from '@mapbox/polyline';

export function polylineToGeoJSON(encodedPolyline: string): GeoJSON.LineString {
	return {
		type: 'LineString',
		coordinates: polyLineToLatLngArray(encodedPolyline).map(([lng, lat]) => [lat, lng])
	};
}

export function polyLineToLatLngArray(encodedPolyline: string) {
	return polyline.decode(encodedPolyline, 7);
}
