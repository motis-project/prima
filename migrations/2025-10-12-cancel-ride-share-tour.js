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


    await sql`
    CREATE OR REPLACE PROCEDURE cancel_request(
    	p_request_id INTEGER,
    	p_user_id INTEGER
    ) AS  $$
    DECLARE
    	v_tour_id INTEGER;
    BEGIN
    	IF NOT EXISTS (
    	    SELECT 1
    			FROM request r
    	    WHERE r.customer = p_user_id
    			AND r.id = p_request_id
    	) THEN
    	    RETURN;
    	END IF;

    	UPDATE request r
    	SET cancelled = true
    	WHERE r.id = p_request_id;

    	UPDATE event e
    	SET cancelled = TRUE
    	WHERE e.request = p_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down() { }