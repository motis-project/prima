import { EARLIEST_SHIFT_START, LATEST_SHIFT_END } from '$lib/constants';
import { describe, expect, it } from 'vitest';
import { getAllowedTimes } from './getAllowedTimes';
import { Interval } from './interval';

function allowedTimesForUtcDay(startTime: string, endTime: string) {
	const requested = new Interval(new Date(startTime).getTime(), new Date(endTime).getTime());

	return getAllowedTimes(
		requested.startTime,
		requested.endTime,
		EARLIEST_SHIFT_START,
		LATEST_SHIFT_END
	)
		.map((allowed) => allowed.intersect(requested))
		.filter((allowed) => allowed !== undefined);
}

describe('allowed times across daylight-saving transitions', () => {
	it('uses summer time after the spring transition', () => {
		expect(
			allowedTimesForUtcDay('2026-03-29T00:00:00.000Z', '2026-03-30T00:00:00.000Z')
		).toMatchObject([
			{
				startTime: new Date('2026-03-29T01:00:00.000Z').getTime(),
				endTime: new Date('2026-03-29T22:00:00.000Z').getTime()
			}
		]);
	});

	it('uses winter time after the autumn transition', () => {
		expect(
			allowedTimesForUtcDay('2026-10-25T00:00:00.000Z', '2026-10-26T00:00:00.000Z')
		).toMatchObject([
			{
				startTime: new Date('2026-10-25T02:00:00.000Z').getTime(),
				endTime: new Date('2026-10-25T23:00:00.000Z').getTime()
			}
		]);
	});
});
