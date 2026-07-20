import { describe, it, expect } from 'vitest';

import { type Itinerary } from '$lib/openapi';
import { getCostFn } from './filterTaxis';

describe('journey cost function tests', () => {
	it('public transit journey', () => {
		const i: Itinerary = {
			duration: 3600,
			startTime: '2026-07-20T12:00:00Z',
			endTime: '2026-07-20T13:00:00Z',
			transfers: 1,
			legs: [
				{
					mode: 'TRANSIT',
					from: { name: 'p1', lat: 1.0, lon: 2.0, level: 0 },
					to: { name: 'p2', lat: 3.0, lon: 4.0, level: 0 },
					duration: 900,
					startTime: '2026-07-20T12:00:00Z',
					endTime: '2026-07-20T12:15:00Z',
					scheduledStartTime: '2026-07-20T12:00:00Z',
					scheduledEndTime: '2026-07-20T12:15:00Z',
					realTime: false,
					scheduled: true,
					legGeometry: { points: '', precision: 0, length: 0 }
				},
				{
					mode: 'TRANSIT',
					from: { name: 'p2', lat: 3.0, lon: 4.0, level: 0 },
					to: { name: 'p3', lat: 5.0, lon: 6.0, level: 0 },
					duration: 900,
					startTime: '2026-07-20T12:45:00Z',
					endTime: '2026-07-20T13:00:00Z',
					scheduledStartTime: '2026-07-20T12:45:00Z',
					scheduledEndTime: '2026-07-20T13:00:00Z',
					realTime: false,
					scheduled: true,
					legGeometry: { points: '', precision: 0, length: 0 }
				}
			]
		};

		const getCost = getCostFn(8, 30, 5, 200);
		expect(getCost(i)).toBe(60 + 8);
	});
	it('mixed taxi journey', () => {
		const i: Itinerary = {
			duration: 3600,
			startTime: '2026-07-20T12:00:00Z',
			endTime: '2026-07-20T13:00:00Z',
			transfers: 1,
			legs: [
				{
					mode: 'ODM',
					from: { name: 'p1', lat: 1.0, lon: 2.0, level: 0 },
					to: { name: 'p2', lat: 3.0, lon: 4.0, level: 0 },
					duration: 900,
					startTime: '2026-07-20T12:00:00Z',
					endTime: '2026-07-20T12:15:00Z',
					scheduledStartTime: '2026-07-20T12:00:00Z',
					scheduledEndTime: '2026-07-20T12:15:00Z',
					realTime: false,
					scheduled: true,
					legGeometry: { points: '', precision: 0, length: 0 }
				},
				{
					mode: 'TRANSIT',
					from: { name: 'p2', lat: 3.0, lon: 4.0, level: 0 },
					to: { name: 'p3', lat: 5.0, lon: 6.0, level: 0 },
					duration: 900,
					startTime: '2026-07-20T12:45:00Z',
					endTime: '2026-07-20T13:00:00Z',
					scheduledStartTime: '2026-07-20T12:45:00Z',
					scheduledEndTime: '2026-07-20T13:00:00Z',
					realTime: false,
					scheduled: true,
					legGeometry: { points: '', precision: 0, length: 0 }
				}
			]
		};

		const getCost = getCostFn(8, 30, 5, 200);
		expect(getCost(i)).toBe(60 + 8 - 15 + 30 + 15 * 5);
	});
	it('direct taxi journey', () => {
		const i: Itinerary = {
			duration: 3600,
			startTime: '2026-07-20T12:00:00Z',
			endTime: '2026-07-20T13:00:00Z',
			transfers: 0,
			legs: [
				{
					mode: 'ODM',
					from: { name: 'p1', lat: 1.0, lon: 2.0, level: 0 },
					to: { name: 'p3', lat: 5.0, lon: 6.0, level: 0 },
					duration: 3600,
					startTime: '2026-07-20T12:00:00Z',
					endTime: '2026-07-20T13:00:00Z',
					scheduledStartTime: '2026-07-20T12:00:00Z',
					scheduledEndTime: '2026-07-20T13:00:00Z',
					realTime: false,
					scheduled: true,
					legGeometry: { points: '', precision: 0, length: 0 }
				}
			]
		};

		const getCost = getCostFn(8, 30, 5, 200);
		expect(getCost(i)).toBe(30 + 60 * 5 + 200);
	});
});
