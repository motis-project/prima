import { LATEST_NIGHT_BOOKING_TIME, NIGHT_TIME_END, NIGHT_TIME_START, TZ } from '$lib/constants';
import { getOffset } from '$lib/util/getOffset';
import { HOUR, MINUTE } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

const berlinDateTime = new Intl.DateTimeFormat('en-GB', {
	timeZone: TZ,
	hourCycle: 'h23',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit'
});

const getDateTimeParts = (time: UnixtimeMs) =>
	Object.fromEntries(
		berlinDateTime
			.formatToParts(time)
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, Number(part.value)])
	) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;

const getPreviousDayBookingDeadline = (pickupTime: UnixtimeMs): UnixtimeMs => {
	const { year, month, day } = getDateTimeParts(pickupTime);
	const previousDay = new Date(Date.UTC(year, month - 1, day - 1));
	const previousYear = previousDay.getUTCFullYear();
	const previousMonth = previousDay.getUTCMonth();
	const previousDate = previousDay.getUTCDate();
	const noon = Date.UTC(previousYear, previousMonth, previousDate, 12);

	return (
		Date.UTC(previousYear, previousMonth, previousDate, LATEST_NIGHT_BOOKING_TIME / HOUR) -
		getOffset(noon)
	);
};

export function requiresTaxiBookingDeadline(
	isNewTour: boolean,
	newDeparture?: UnixtimeMs,
	originalDeparture?: UnixtimeMs
): boolean {
	return (
		isNewTour ||
		(newDeparture !== undefined &&
			originalDeparture !== undefined &&
			newDeparture < originalDeparture)
	);
}

export function isTaxiBookingAllowed(
	pickupTime: UnixtimeMs,
	bookingTime: UnixtimeMs = Date.now()
): boolean {
	console.log('checking things', new Date(pickupTime));
	console.log(new Date(bookingTime));
	const { hour, minute, second } = getDateTimeParts(pickupTime);
	const timeOfDay = hour * HOUR + minute * MINUTE + second * 1000;
	if (timeOfDay < NIGHT_TIME_START || timeOfDay >= NIGHT_TIME_END) {
		return true;
	}
	if (bookingTime > getPreviousDayBookingDeadline(pickupTime)) {
		console.log('not permitted');
	}
	return bookingTime <= getPreviousDayBookingDeadline(pickupTime);
}
