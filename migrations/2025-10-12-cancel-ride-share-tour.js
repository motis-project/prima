import { sql } from 'kysely';

export async function up(db) {
    await sql`
        CREATE OR REPLACE PROCEDURE cancel_ride_share_tour(
        	p_tour_id INTEGER,
        	p_user_id INTEGER
        ) AS $$
        BEGIN
        	IF NOT EXISTS (
        	    SELECT 1
        	    FROM ride_share_tour t
        	    JOIN ride_share_vehicle v ON v.id = t.vehicle
        	    WHERE t.id = p_tour_id
        	    AND v.owner = p_user_id
        	) THEN
        	    RETURN;
        	END IF;

        	UPDATE ride_share_tour t
        	SET cancelled = TRUE
        	WHERE t.id = p_tour_id;

        	UPDATE request r
        	SET cancelled = TRUE
        	WHERE r.ride_share_tour = p_tour_id;

        	UPDATE event e
        	SET cancelled = TRUE
        	WHERE e.request IN (SELECT id FROM request WHERE ride_share_tour = p_tour_id);
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down() { }