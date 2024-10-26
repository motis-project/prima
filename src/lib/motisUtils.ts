import type { Coordinates } from './location';

export const coordinatesToStr = (c: Coordinates) => {
	return `${c.lat};${c.lng}`;
};
