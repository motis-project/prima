import { createSession } from '$lib/server/auth/session';
import { addTestUser, clearDatabase } from '$lib/testHelpers';
import { TZ } from '$lib/constants';
import { getOffset } from '$lib/util/getOffset';
import { MINUTE } from '$lib/util/time';

export async function prepareTest() {
	await clearDatabase();
	const mockUserId = (await addTestUser()).id;
	const sessionToken = 'generateSessionToken()';
	console.log('Creating session for user ', mockUserId);
	await createSession(sessionToken, mockUserId);
	return mockUserId;
}

export function getNextWednesday(dateWithCorrectDayTime: Date, dateRelativeToNextWednesday: Date) {
	const dayOfWeek = dateRelativeToNextWednesday.getDay();
	const daysUntilNextWednesday = (10 - dayOfWeek) % 7 || 7;
	const nextWednesday = new Date(dateRelativeToNextWednesday);
	nextWednesday.setDate(nextWednesday.getDate() + daysUntilNextWednesday);
	nextWednesday.setHours(
		dateWithCorrectDayTime.getHours(),
		dateWithCorrectDayTime.getMinutes(),
		dateWithCorrectDayTime.getSeconds(),
		dateWithCorrectDayTime.getMilliseconds()
	);
	return nextWednesday.getTime();
}

const BASE_HOUR = 13;

function getBaseDate(now = new Date()) {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	});
	const parts = Object.fromEntries(
		formatter
			.formatToParts(now)
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, Number(part.value)])
	);

	const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 2, 12));
	const daysUntilNextWednesday = (3 - date.getUTCDay() + 7) % 7 || 7;
	date.setUTCDate(date.getUTCDate() + daysUntilNextWednesday);

	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();
	const offset = getOffset(Date.UTC(year, month, day, 12));
	return Date.UTC(year, month, day, BASE_HOUR) - offset;
}

const BASE_DATE = getBaseDate();

export const inXMinutes = (x: number) => BASE_DATE + x * MINUTE;

export const black = async (body: string) => {
	return await fetch('http://localhost:5173/api/blacklist', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body
	});
};

export const white = async (body: string) => {
	return await fetch('http://localhost:5173/api/whitelist', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body
	});
};

export const whiteRideShare = async (body: string) => {
	return await fetch('http://localhost:5173/api/whitelistRideShare', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body
	});
};
