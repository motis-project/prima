import { sql, type RawBuilder } from 'kysely';
import maplibregl from 'maplibre-gl';
import { WGS84 } from '$lib/constants';

export const covers = (coordinates: maplibregl.LngLatLike): RawBuilder<boolean> => {
	const c = maplibregl.LngLat.convert(coordinates);
	return sql<boolean>`ST_Covers(zone.area, ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}),${WGS84}))`;
};

export const coversExpanded = (coordinates: maplibregl.LngLatLike): RawBuilder<boolean> => {
	const c = maplibregl.LngLat.convert(coordinates);
	return sql<boolean>`ST_Covers(zone.expanded, ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}),${WGS84}))`;
};
