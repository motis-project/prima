import { describe, expect, it } from 'vitest';
import { getAllowedTimes } from './getAllowedTimes';
import { Interval } from './interval';
import { DAY } from './time';

describe('getAllowedTimes', () => {
	it('allows an operation crossing local midnight with a full-day shift', () => {
		const operation = new Interval(
			Date.parse('2026-01-01T22:30:00Z'),
			Date.parse('2026-01-01T23:30:00Z')
		);

		const allowed = getAllowedTimes(operation.startTime, operation.endTime, 0, DAY);
		expect(allowed.some((interval) => interval.contains(operation))).toBe(true);
	});
});
