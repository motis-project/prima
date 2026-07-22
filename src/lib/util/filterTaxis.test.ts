import { describe, it, expect } from 'vitest';

import { type Itinerary } from '$lib/openapi';
import { dynamicSlidingWindowMean, getCostFn, getWindowSize, windowMean } from './filterTaxis';

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

describe('filter taxi damping', () => {
	it('getWindowSize', () => {
		const a = [0, 1, 2, 3, 4, 5, 6];
		expect(getWindowSize(a, 0, 2)).toBe(0);
		expect(getWindowSize(a, 1, 2)).toBe(1);
		expect(getWindowSize(a, 2, 2)).toBe(2);
		expect(getWindowSize(a, 3, 2)).toBe(2);
		expect(getWindowSize(a, 4, 2)).toBe(2);
		expect(getWindowSize(a, 5, 2)).toBe(1);
		expect(getWindowSize(a, 6, 2)).toBe(0);
	});
	it('windowMean', () => {
		const a = [0, 1, 2, 3, 4, 5, 6];
		expect(windowMean(a, 0, 1)).toBe(0);
		expect(windowMean(a, 2, 4)).toBe(2.5);
		expect(windowMean(a, 1, 6)).toBe(3);
	});
	it('dynamicSlidingWindowMean', () => {
		const a = [0, 1, 2, 3, 4, 5, 6];
		expect(dynamicSlidingWindowMean(a, 2)).toEqual(a);
		const v = [5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5];
		expect(dynamicSlidingWindowMean(v, 3)).toEqual([
			5, 4, 3, 2.285714286, 1.857142857, 1.714285714, 1.857142857, 2.285714286, 3, 4, 5
		]);
	});
});
