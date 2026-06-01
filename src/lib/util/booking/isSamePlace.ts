import { COORDINATE_ROUNDING_ERROR_THRESHOLD } from '$lib/constants';
import type { Coordinates } from '$lib/util/Coordinates';

export const isSamePlace = (c1: Coordinates, c2: Coordinates) => {
	return (
		Math.abs(c1.lat - c2.lat) < COORDINATE_ROUNDING_ERROR_THRESHOLD &&
		Math.abs(c1.lng - c2.lng) < COORDINATE_ROUNDING_ERROR_THRESHOLD
	);
};
