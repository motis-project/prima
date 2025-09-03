import { SCHEDULED_TIME_BUFFER_DROPOFF_RELATIVE } from '$lib/constants';

export function getScheduledTimeBufferDropoff(travelDurationMs: number): number {
	return travelDurationMs * SCHEDULED_TIME_BUFFER_DROPOFF_RELATIVE;
}
