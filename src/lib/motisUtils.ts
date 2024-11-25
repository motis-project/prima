import type { Coordinates } from './location';

export const coordinatesToStr = (c: Coordinates) => {
	return `${c.lat};${c.lng}`;
};

export const coordinatesToPlace = (c: Coordinates) => {
	return `${c.lat},${c.lng},0`;
};

export const customQuerySerializer = (params: Record<string, unknown>): string => {
	const qs: string[] = [];

	const append = (key: string, value: unknown) => {
		qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
	};

	const encodePair = (key: string, value: unknown) => {
		if (value === undefined || value === null) {
			return;
		}

		if (value instanceof Date) {
			append(key, value.toISOString());
		} else if (Array.isArray(value)) {
			append(key, value.join(','));
		} else if (typeof value === 'object') {
			Object.entries(value).forEach(([k, v]) => encodePair(`${key}[${k}]`, v));
		} else {
			append(key, value);
		}
	};

	Object.entries(params).forEach(([key, value]) => encodePair(key, value));

	return qs.length ? `?${qs.join('&')}` : '';
};
