import crypto from 'crypto';
import { env } from '$env/dynamic/private';

export function signEntry(
	fromLat: number,
	fromLng: number,
	toLat: number,
	toLng: number,
	startTime: number,
	endTime: number,
	startFixed: boolean,
	tripId?: string | undefined
): string {
	const serialized = JSON.stringify({
		fromLat,
		fromLng,
		toLat,
		toLng,
		startTime: startTime,
		endTime: endTime,
		startFixed,
		tripId
	});
	return crypto.createHmac('sha256', env.SECRET_KEY!).update(serialized).digest('hex');
}
