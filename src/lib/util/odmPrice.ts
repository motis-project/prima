import type { Itinerary, Leg } from '$lib/openapi';

export const odmPrice = (it: Itinerary, passengers: number) =>
	it.legs.reduce((acc: number, l: Leg) => acc + (l.mode === 'ODM' ? passengers * 3 : 0), 0);
