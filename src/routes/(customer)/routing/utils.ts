import type { Leg } from '$lib/openapi';
import type { LegLike } from '$lib/ui/modeStyle';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function isRideShareLeg(l: Leg | LegLike) {
	return l.mode == 'RIDE_SHARING';
}

export function isTaxiLeg(l: Leg | LegLike) {
	return l.mode == 'ODM';
}

export function isOdmLeg(l: Leg | LegLike) {
	return l.mode == 'ODM' || l.mode == 'RIDE_SHARING';
}
