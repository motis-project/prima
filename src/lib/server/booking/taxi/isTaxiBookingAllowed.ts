import { LATEST_NIGHT_BOOKING_TIME, NIGHT_TIME_END, NIGHT_TIME_START } from '$lib/constants';
import { getOffset } from '$lib/util/getOffset';
import { InsertHow } from '$lib/util/booking/insertionTypes';
import { DAY, HOUR, roundToUnit } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

const getBerlinTime = (time: UnixtimeMs): UnixtimeMs => {
	const noon = roundToUnit(time, DAY, Math.floor) + 12 * HOUR;
	return time + getOffset(noon);
};

const getPreviousDayBookingDeadline = (departureTime: UnixtimeMs): UnixtimeMs => {
	const previousDay = roundToUnit(getBerlinTime(departureTime), DAY, Math.floor) - DAY;
	return previousDay + LATEST_NIGHT_BOOKING_TIME - getOffset(previousDay + 12 * HOUR);
};

export function requiresTaxiBookingDeadline(
	insertionHow: InsertHow,
	newDeparture?: UnixtimeMs,
	originalDeparture?: UnixtimeMs
): boolean {
	switch (insertionHow) {
		case InsertHow.NEW_TOUR:
			return true;
		case InsertHow.PREPEND:
			return (
				newDeparture !== undefined &&
				originalDeparture !== undefined &&
				newDeparture < originalDeparture
			);
		default:
			return false;
	}
}

export function isTaxiBookingAllowed(
	departureTime: UnixtimeMs,
	bookingTime: UnixtimeMs = Date.now()
): boolean {
	const timeOfDay = getBerlinTime(departureTime) % DAY;
	if (timeOfDay < NIGHT_TIME_START || timeOfDay >= NIGHT_TIME_END) {
		return true;
	}
	return bookingTime <= getPreviousDayBookingDeadline(departureTime);
}
