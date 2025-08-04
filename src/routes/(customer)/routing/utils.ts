import type { Leg } from '$lib/openapi';
import type { LegLike } from '$lib/ui/modeStyle';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function isRideShareLeg(l: Leg | LegLike) {
	return l.agencyId === 'RideShare' || true;
}
