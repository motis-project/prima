import { describe, expect, it } from 'vitest';
import { haversineDistance } from './createStatistics';

describe('haversineDistance', () => {
	it('returns 0 for identical coordinates', () => {
		const berlin = { lat: 52.52, lng: 13.405 };

		expect(haversineDistance(berlin, berlin)).toBe(0);
	});

	it('is symmetric', () => {
		const berlin = { lat: 52.52, lng: 13.405 };
		const paris = { lat: 48.8566, lng: 2.3522 };

		const aToB = haversineDistance(berlin, paris);
		const bToA = haversineDistance(paris, berlin);
		
		expect(aToB).toBeCloseTo(bToA, 8);
	});

	it('calculates Berlin to Paris distance in meters', () => {
		const berlin = { lat: 52.52, lng: 13.405 };
		const paris = { lat: 48.8566, lng: 2.3522 };

		const distance = haversineDistance(berlin, paris);

		// Great-circle distance is roughly 877 km
		expect(distance).toBeGreaterThan(875_000);
		expect(distance).toBeLessThan(879_000);
	});

	it('calculates short distances reasonably', () => {
		const a = { lat: 52.52, lng: 13.405 };
		const b = { lat: 52.5201, lng: 13.405 };

		const distance = haversineDistance(a, b);

		// 0.0001 degrees latitude is about 11.1 meters
		expect(distance).toBeGreaterThan(11);
		expect(distance).toBeLessThan(12);
	});

	it('handles crossing the antimeridian', () => {
		const a = { lat: 0, lng: 179.9 };
		const b = { lat: 0, lng: -179.9 };

		const distance = haversineDistance(a, b);

		// 0.2 degrees at equator ≈ 22.2 km
		expect(distance).toBeGreaterThan(22_000);
		expect(distance).toBeLessThan(22_300);
	});
});