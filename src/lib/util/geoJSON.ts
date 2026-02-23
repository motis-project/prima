import { sql } from 'kysely';
import { db } from '$lib/server/db';

export async function areasGeoJSON() {
	return await sql`
            SELECT 'FeatureCollection' AS TYPE,
                array_to_json(array_agg(f)) AS features
            FROM
                (SELECT 'Feature' AS TYPE,
                    ST_AsGeoJSON(lg.area, 15, 0)::json As geometry,
                    json_build_object('id', lg.id, 'name', lg.name) AS properties
                FROM zone AS lg WHERE EXISTS (SELECT company.id FROM company WHERE lg.id = company.zone )) AS f`.execute(
		db
	);
}

export async function rideshareGeoJSON() {
	return await sql`
		SELECT 'FeatureCollection' AS TYPE,
			array_to_json(array_agg(f)) AS features
		FROM
			(SELECT 'Feature' AS TYPE,
				ST_AsGeoJSON(lg.area, 15, 0)::json As geometry,
				json_build_object('id', id, 'name', name) AS properties
			FROM ride_share_zone AS lg) AS f`.execute(db);
}
