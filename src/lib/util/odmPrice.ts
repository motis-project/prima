import type { Itinerary, Leg } from '$lib/openapi';

export const odmPrice = (it: Itinerary, passengers: number, kids: number) =>
	it.legs.reduce(
		(acc: number, l: Leg) => acc + (l.mode === 'ODM' ? (passengers - kids) * 3 : 0),
		0
	);
