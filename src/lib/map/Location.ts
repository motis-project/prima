import maplibregl from 'maplibre-gl';
import type { Match } from '$lib/openapi';

const COORD_LVL_REGEX = /^([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)$/;
const COORD_REGEX = /^([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)$/;

export type Location = {
	label?: string;
	value: {
		match?: Match;
		precision?: number;
	};
};

export const parseCoordinatesToLocation = (str?: string): Location | undefined => {
	if (!str) {
		return undefined;
	}
	const coordinateWithLevel = str.match(COORD_LVL_REGEX);
	if (coordinateWithLevel) {
		return posToLocation(
			[Number(coordinateWithLevel[3]), Number(coordinateWithLevel[1])],
			Number(coordinateWithLevel[5])
		);
	}

	const coordinate = str.match(COORD_REGEX);
	if (coordinate) {
		return posToLocation([Number(coordinate[3]), Number(coordinate[1])]);
	}

	return undefined;
};

export function posToLocation(pos: maplibregl.LngLatLike, level?: number): Location {
	const { lat, lng } = maplibregl.LngLat.convert(pos);
	const label = level == undefined ? `${lat},${lng}` : `${lat},${lng},${level}`;
	return {
		label,
		value: {
			match: {
				lat,
				lon: lng,
				level,
				id: '',
				areas: [],
				type: 'PLACE',
				name: label,
				tokens: [],
				score: 0
			},
			precision: 100
		}
	};
}

export const parseLocation = (
	place?: string | null | undefined,
	name?: string | null | undefined
): Location => {
	if (!place || place.trim() === '') {
		return { label: '', value: { match: undefined } };
	}

	const coord = parseCoordinatesToLocation(place);
	if (coord) {
		if (name) {
			coord.label = name;
			coord.value!.match!.name = name;
		}
		return coord;
	}
	return {
		label: name || '',
		value: {
			match: {
				lat: 0.0,
				lon: 0.0,
				level: 0.0,
				id: place,
				areas: [],
				type: 'STOP',
				name: name || '',
				tokens: [],
				score: 0
			}
		}
	};
};
