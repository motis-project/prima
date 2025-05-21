import { LOCALE } from '$lib/constants';
import { PUBLIC_FIXED_PRICE } from '$env/static/public';

import type { Itinerary, Leg } from '$lib/openapi';

export const odmPrice = (it: Itinerary, passengers: number, kids: number) =>
	it.legs.reduce(
		(acc: number, l: Leg) =>
			acc + (l.mode === 'ODM' ? (passengers - kids) * parseInt(PUBLIC_FIXED_PRICE) : 0),
		0
	);

export const getEuroString = (price: number | null) => {
	return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' }).format(
		(price ?? 0) / 100
	);
};
