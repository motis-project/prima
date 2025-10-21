import { createSession } from '$lib/server/auth/session';
import { addTestUser, clearDatabase } from '$lib/testHelpers';
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

const baseDate = new Date();
baseDate.setDate(baseDate.getDate() + 2);
baseDate.setHours(13, 0, 0, 0);
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
