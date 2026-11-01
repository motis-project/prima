import type { Match } from './openapi';

const nonConcretePlaceCategories = new Set([
	'none',
	'place_6',
	'place_capital_8',
	'continent',
	'country',
	'state',
	'region',
	'province',
	'district',
	'county',
	'subdistrict',
	'municipality',
	'city',
	'borough',
	'suburb',
	'quarter',
	'neighbourhood',
	'city_block',
	'plot',
	'town',
	'village',
	'hamlet',
	'isolated_dwelling',
	'farm',
	'allotments',
	'archipelago',
	'island',
	'islet',
	'locality',
	'polder',
	'sea',
	'ocean'
]);

export function isConcreteLocation(match: Match) {
	return (
		(match.type === 'ADDRESS' && match.houseNumber !== undefined) ||
		match.type === 'STOP' ||
		(match.type === 'PLACE' &&
			match.category !== undefined &&
			!nonConcretePlaceCategories.has(match.category))
	);
}
