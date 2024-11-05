import type { Coordinates } from './location';

export const coordinatesToStr = (c: Coordinates) => {
	return `${c.lat};${c.lng}`;
};

export const coordinatesToPlace = (c: Coordinates) => {
	return `${c.lat},${c.lng},0`;
};
