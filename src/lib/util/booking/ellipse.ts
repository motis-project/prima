import { ELLIPSE_MAX_KMH } from '$lib/constants';
import type { Coordinates } from '$lib/util/Coordinates';

export type PreparedDetourEllipse = {
	originLatRad: number;
	originLngRad: number;
	cosOriginLat: number;

	centerX: number;
	centerY: number;

	axisXx: number;
	axisXy: number;
	axisYx: number;
	axisYy: number;

	invAaSq: number;
	invBbSq: number;

	minX: number;
	minY: number;
	maxX: number;
	maxY: number;

	pointOnly: boolean;
};

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
	return (rad * 180) / Math.PI;
}

function projectToLocalMeters(
	p: Coordinates,
	originLatRad: number,
	originLngRad: number,
	cosOriginLat: number
): { x: number; y: number } {
	const latRad = toRad(p.lat);
	const lngRad = toRad(p.lng);

	const x = (lngRad - originLngRad) * cosOriginLat * EARTH_RADIUS_M;
	const y = (latRad - originLatRad) * EARTH_RADIUS_M;

	return { x, y };
}

function unprojectFromLocalMeters(
	x: number,
	y: number,
	originLatRad: number,
	originLngRad: number,
	cosOriginLat: number
): [number, number] {
	return [
		toDeg(originLngRad + x / (cosOriginLat * EARTH_RADIUS_M)),
		toDeg(originLatRad + y / EARTH_RADIUS_M)
	];
}

export function prepareDetourEllipse(
	a: Coordinates,
	b: Coordinates,
	maxDetourSeconds: number
): PreparedDetourEllipse {
	if (maxDetourSeconds < 0 || !Number.isFinite(maxDetourSeconds)) {
		throw new Error('maxDetourSeconds must be a finite number >= 0');
	}
	if (ELLIPSE_MAX_KMH <= 0 || !Number.isFinite(ELLIPSE_MAX_KMH)) {
		throw new Error('maxSpeedKmh must be a positive finite number');
	}

	const maxSpeedMps = ELLIPSE_MAX_KMH / 3.6;

	const originLatRad = toRad((a.lat + b.lat) / 2);
	const originLngRad = toRad((a.lng + b.lng) / 2);
	const cosOriginLat = Math.cos(originLatRad);

	const axy = projectToLocalMeters(a, originLatRad, originLngRad, cosOriginLat);
	const bxy = projectToLocalMeters(b, originLatRad, originLngRad, cosOriginLat);

	const dx = bxy.x - axy.x;
	const dy = bxy.y - axy.y;
	const d = Math.hypot(dx, dy);

	const centerX = (axy.x + bxy.x) / 2;
	const centerY = (axy.y + bxy.y) / 2;

	const allowedExtraDistance = maxSpeedMps * maxDetourSeconds;
	const totalDistance = d + allowedExtraDistance;

	const semiMajor = totalDistance / 2;
	const focalOffset = d / 2;
	const semiMinorSq = Math.max(0, semiMajor * semiMajor - focalOffset * focalOffset);
	const semiMinor = Math.sqrt(semiMinorSq);

	if (d === 0 && semiMajor === 0) {
		return {
			originLatRad,
			originLngRad,
			cosOriginLat,
			centerX,
			centerY,
			axisXx: 1,
			axisXy: 0,
			axisYx: 0,
			axisYy: 1,
			invAaSq: Infinity,
			invBbSq: Infinity,
			minX: centerX,
			minY: centerY,
			maxX: centerX,
			maxY: centerY,
			pointOnly: true
		};
	}

	if (d === 0) {
		const radius = semiMajor;
		const invRSq = 1 / (radius * radius);

		return {
			originLatRad,
			originLngRad,
			cosOriginLat,
			centerX,
			centerY,
			axisXx: 1,
			axisXy: 0,
			axisYx: 0,
			axisYy: 1,
			invAaSq: invRSq,
			invBbSq: invRSq,
			minX: centerX - radius,
			minY: centerY - radius,
			maxX: centerX + radius,
			maxY: centerY + radius,
			pointOnly: false
		};
	}

	const axisXx = dx / d;
	const axisXy = dy / d;
	const axisYx = -axisXy;
	const axisYy = axisXx;

	const extentX = Math.sqrt(
		semiMajor * semiMajor * axisXx * axisXx + semiMinor * semiMinor * axisYx * axisYx
	);
	const extentY = Math.sqrt(
		semiMajor * semiMajor * axisXy * axisXy + semiMinor * semiMinor * axisYy * axisYy
	);

	return {
		originLatRad,
		originLngRad,
		cosOriginLat,
		centerX,
		centerY,
		axisXx,
		axisXy,
		axisYx,
		axisYy,
		invAaSq: 1 / (semiMajor * semiMajor),
		invBbSq: semiMinor > 0 ? 1 / (semiMinor * semiMinor) : Infinity,
		minX: centerX - extentX,
		minY: centerY - extentY,
		maxX: centerX + extentX,
		maxY: centerY + extentY,
		pointOnly: false
	};
}

export function preparedDetourEllipseToGeoJSON(
	ellipse: PreparedDetourEllipse,
	steps = 72
): GeoJSON.FeatureCollection {
	if (ellipse.pointOnly) {
		const coordinates = unprojectFromLocalMeters(
			ellipse.centerX,
			ellipse.centerY,
			ellipse.originLatRad,
			ellipse.originLngRad,
			ellipse.cosOriginLat
		);
		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'Point',
						coordinates
					}
				}
			]
		};
	}

	const semiMajor = 1 / Math.sqrt(ellipse.invAaSq);
	const semiMinor = 1 / Math.sqrt(ellipse.invBbSq);
	const coordinates = Array.from({ length: steps + 1 }, (_, i) => {
		const theta = (2 * Math.PI * i) / steps;
		const alongMajor = semiMajor * Math.cos(theta);
		const alongMinor = semiMinor * Math.sin(theta);
		const x = ellipse.centerX + alongMajor * ellipse.axisXx + alongMinor * ellipse.axisYx;
		const y = ellipse.centerY + alongMajor * ellipse.axisXy + alongMinor * ellipse.axisYy;
		return unprojectFromLocalMeters(
			x,
			y,
			ellipse.originLatRad,
			ellipse.originLngRad,
			ellipse.cosOriginLat
		);
	});

	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'Polygon',
					coordinates: [coordinates]
				}
			}
		]
	};
}

export function isPointInPreparedDetourEllipse(
	ellipse: PreparedDetourEllipse,
	p: Coordinates
): boolean {
	const projected = projectToLocalMeters(
		p,
		ellipse.originLatRad,
		ellipse.originLngRad,
		ellipse.cosOriginLat
	);

	const px = projected.x;
	const py = projected.y;

	if (px < ellipse.minX || px > ellipse.maxX || py < ellipse.minY || py > ellipse.maxY) {
		return false;
	}

	const qx = px - ellipse.centerX;
	const qy = py - ellipse.centerY;

	if (ellipse.pointOnly) {
		return qx === 0 && qy === 0;
	}

	const u = qx * ellipse.axisXx + qy * ellipse.axisXy;
	const v = qx * ellipse.axisYx + qy * ellipse.axisYy;

	return u * u * ellipse.invAaSq + v * v * ellipse.invBbSq <= 1;
}
