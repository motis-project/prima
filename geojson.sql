SELECT 'FeatureCollection' AS TYPE,
	array_to_json(array_agg(f)) AS features
FROM
(
	SELECT
		'Feature' AS TYPE,
		ST_AsGeoJSON(lg.area, 15, 0)::json AS geometry,
		json_build_object('id', id, 'name', name) AS properties
	FROM zone AS lg
	WHERE name = 'Weißwasser'
) AS f
