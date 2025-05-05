import { sql } from 'kysely';

export async function up(db) {
    await sql`CREATE OR REPLACE PROCEDURE anonymize(t1 DOUBLE PRECISION, t2 DOUBLE PRECISION) 
    AS $$
    DECLARE
        j RECORD;
        legs JSONB;
        leg JSONB;
        leg_index INT;
    BEGIN
        -- Anonymize request table
        UPDATE request
        SET customer = null
        FROM tour
        WHERE tour.id = request.tour
        AND tour.arrival >= t1
        AND tour.arrival < t2;

        -- Anonymize event table
        UPDATE event
        SET lat = ROUND(event.lat::numeric, 2),
            lng = ROUND(event.lng::numeric, 2),
            address = 'anonymer Ort'
        FROM request
        INNER JOIN tour ON request.tour = tour.id
        WHERE event.request = request.id
        AND tour.arrival > t1
        AND tour.arrival < t2;

        -- Anonymize journey table
        FOR j IN
            SELECT journey.id, journey.json
            FROM journey
            LEFT JOIN request r1 ON journey.request1 = r1.id
            LEFT JOIN request r2 ON journey.request2 = r2.id
            LEFT JOIN tour tour1 ON r1.tour = tour1.id AND tour1.arrival > t1 AND tour1.arrival < t2
            LEFT JOIN tour tour2 ON r2.tour = tour2.id AND tour2.arrival > t1 AND tour2.arrival < t2
            WHERE
                journey.request1 IS NOT NULL
                OR
                journey.request2 IS NOT NULL

            LOOP
                legs := j.json->'legs';
                leg_index := 0;
            FOR leg IN
            SELECT * FROM jsonb_array_elements(legs) AS leg
            LOOP
                IF leg->>'mode' = 'ODM' THEN
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'lat'],
                        ROUND((leg->'from'->>'lat')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'lon'],
                        ROUND((leg->'from'->>'lon')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'from', 'name'],
                        '"anonymer Ort"'::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'lat'],
                        ROUND((leg->'to'->>'lat')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'lon'],
                        ROUND((leg->'to'->>'lon')::numeric, 2)::text::jsonb
                    );
                    j.json := jsonb_set(
                        j.json,
                        ARRAY['legs', leg_index::text, 'to', 'name'],
                        '"anonymer Ort"'::jsonb
                    );
                END IF;
                leg_index := leg_index + 1;
            END LOOP;
            UPDATE journey SET json = j.json WHERE id = j.id;
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}
