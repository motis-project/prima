import { createSession } from '$lib/server/auth/session';
import { addTestUser, clearDatabase } from '$lib/testHelpers';
import { getOffset } from '$lib/util/getOffset';
import { DAY, HOUR, MINUTE, roundToUnit } from '$lib/util/time';

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

const now = new Date();
const baseDateUtc = new Date(
	Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 13, 0, 0, 0)
);
const noonBaseDate =
	roundToUnit(
		new Date((now.getFullYear(), now.getMonth(), now.getDate() + 2, 0, 0, 0, 0)).getTime(),
		DAY,
		Math.floor
	) +
	12 * HOUR;
const offset = getOffset(noonBaseDate);
const baseDate = new Date(baseDateUtc.getTime() - offset);
const BASE_DATE = getNextWednesday(baseDate, baseDate);

export const dateInXMinutes = (x: number) => new Date(BASE_DATE + x * MINUTE);
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
