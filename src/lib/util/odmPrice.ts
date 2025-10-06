import { LOCALE } from '$lib/constants';
import { env } from '$env/dynamic/public';

import type { Itinerary, Leg } from '$lib/openapi';
import { isTaxiLeg } from '../../routes/(customer)/routing/utils';

export const odmPrice = (it: Itinerary, passengers: number, kids: number) =>
	it.legs.reduce(
		(acc: number, l: Leg) =>
			acc + (isTaxiLeg(l) ? (passengers - kids) * parseInt(env.PUBLIC_FIXED_PRICE) : 0),
		0
	);

export const getEuroString = (price: number | null) => {
	return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' }).format(
		(price ?? 0) / 100
	);
};
