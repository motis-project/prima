import type { Position } from 'geojson';
import { haversineDestination } from './haversine';

const steps = 72;

export function circlePolygon(center: Position, radius: number): Position[][] {
	let polygon = new Array<Position>();
	for (let i = 0; i != steps; ++i) {
		polygon.push(haversineDestination(center, radius, ((i * 1) / steps) * 360));
	}
	polygon.push(polygon[0]);
	return [polygon];
}
