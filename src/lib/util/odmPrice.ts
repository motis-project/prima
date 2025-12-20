import { LOCALE } from '$lib/constants';
import { env } from '$env/dynamic/public';
import type { Itinerary, Leg } from '$lib/openapi';
import { isTaxiLeg } from './booking/checkLegType';

export const legOdmPrice = (
	totalPassengers: number,
	freePassengers: number,
	reducedPassengers: number
) =>
	Math.abs(
		(totalPassengers - freePassengers - reducedPassengers) * parseInt(env.PUBLIC_FIXED_PRICE) +
			reducedPassengers * parseInt(env.PUBLIC_FIXED_REDUCED_PRICE)
	);

export const odmPrice = (
	it: Itinerary,
	totalPassengers: number,
	freePassengers: number,
	reducedPassengers: number
) =>
	it.legs.reduce(
		(acc: number, l: Leg) =>
			acc + (isTaxiLeg(l) ? legOdmPrice(totalPassengers, freePassengers, reducedPassengers) : 0),
		0
	);

export const getEuroString = (price: number | null) => {
	return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' }).format(
		(price ?? 0) / 100
	);
};
