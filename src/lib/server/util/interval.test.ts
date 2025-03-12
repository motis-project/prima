import { MINUTE } from '$lib/util/time';
import { describe, it, expect } from 'vitest';
import { Interval } from '../../util/interval';

const BASE_MS = new Date('4000-01-01T00:00:00.0Z').getTime();
const inX = (m: number) => {
	return BASE_MS + m * MINUTE;
};

describe('subtract interval arrays test', () => {
	it('overlapping', () => {
		const a = [new Interval(inX(1), inX(5)), new Interval(inX(7), inX(9))];
		const b = [new Interval(inX(3), inX(8))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(2);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(1);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(3);
		expect((res[1].startTime - BASE_MS) / 60000).toBe(8);
		expect((res[1].endTime - BASE_MS) / 60000).toBe(9);
	});

	it('touching', () => {
		const a = [new Interval(inX(1), inX(5)), new Interval(inX(7), inX(9))];
		const b = [new Interval(inX(5), inX(9))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(1);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(1);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(5);
	});

	it('minuend contains subtrahend', () => {
		const a = [new Interval(inX(1), inX(10))];
		const b = [new Interval(inX(5), inX(9))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(2);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(1);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(5);
		expect((res[1].startTime - BASE_MS) / 60000).toBe(9);
		expect((res[1].endTime - BASE_MS) / 60000).toBe(10);
	});

	it('minuend contains subtrahend, same endpoint', () => {
		const a = [new Interval(inX(1), inX(10))];
		const b = [new Interval(inX(5), inX(10))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(1);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(1);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(5);
	});

	it('minuend contains subtrahend, same startpoint', () => {
		const a = [new Interval(inX(1), inX(10))];
		const b = [new Interval(inX(1), inX(7))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(1);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(7);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(10);
	});

	it('equal', () => {
		const a = [new Interval(inX(1), inX(7))];
		const b = [new Interval(inX(1), inX(7))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(0);
	});

	it('subtrahend contains minuend', () => {
		const a = [new Interval(inX(1), inX(7))];
		const b = [new Interval(inX(1), inX(8))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(0);
	});

	it('2 minuends', () => {
		const a = [new Interval(inX(1), inX(6)), new Interval(inX(8), inX(12))];
		const b = [new Interval(inX(5), inX(10))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(2);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(1);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(5);
		expect((res[1].startTime - BASE_MS) / 60000).toBe(10);
		expect((res[1].endTime - BASE_MS) / 60000).toBe(12);
	});

	it('2 subtrahends', () => {
		const a = [new Interval(inX(1), inX(6))];
		const b = [new Interval(inX(0), inX(4)), new Interval(inX(5), inX(10))];
		const res = Interval.subtract(a, b);
		expect(res.length).toBe(1);
		expect((res[0].startTime - BASE_MS) / 60000).toBe(4);
		expect((res[0].endTime - BASE_MS) / 60000).toBe(5);
	});
});
