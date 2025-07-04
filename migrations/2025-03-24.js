import { sql } from 'kysely';

export async function up(db) {
    await sql`DROP PROCEDURE IF EXISTS cancel_request;`.execute(db);
    await sql`
    CREATE FUNCTION cancel_request(
    	p_request_id INTEGER,
    	p_user_id INTEGER,
    	p_now BIGINT
    ) RETURNS BOOLEAN AS $$
    DECLARE
    	v_tour_id INTEGER;
    	v_all_requests_cancelled BOOLEAN;
    BEGIN
    	IF NOT EXISTS (
    	    SELECT 1
    			FROM request r
    	    WHERE r.customer = p_user_id
    			AND r.id = p_request_id
    	) THEN
    	    RETURN FALSE;
    	END IF;

    	IF (
    		SELECT communicated_time
    		FROM request r
    		JOIN event e ON r.id = e.request
    		WHERE r.id = p_request_id
    		ORDER BY e.communicated_time ASC
    		LIMIT 1
    	) <= p_now THEN
    		RETURN FALSE;
    	END IF;

    	UPDATE request r
    	SET cancelled = true
    	WHERE r.id = p_request_id;

    	SELECT tour INTO v_tour_id
    	FROM request
    	WHERE id = p_request_id;

    	SELECT bool_and(cancelled) INTO v_all_requests_cancelled
    	FROM request
    	WHERE tour = v_tour_id;

    	IF v_all_requests_cancelled THEN
    		UPDATE tour
    		SET cancelled = TRUE
    		WHERE id = v_tour_id;
    	END IF;

    	UPDATE event e
    	SET cancelled = TRUE
    	WHERE e.request = p_request_id;

    	RETURN v_all_requests_cancelled;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down(db) {
    await sql`DROP FUNCTION IF EXISTS cancel_request;`.execute(db);
    await sql`
    CREATE PROCEDURE cancel_request(
        p_request_id INTEGER,
        p_user_id INTEGER,
        p_now BIGINT
    ) AS $$
    DECLARE
        v_tour_id INTEGER;
        v_all_requests_cancelled BOOLEAN;
    BEGIN
        IF NOT EXISTS (
            SELECT 1
                FROM request r
            WHERE r.customer = p_user_id
                AND r.id = p_request_id
        ) THEN
            RETURN;
        END IF;
    
        IF (
            SELECT communicated_time
            FROM request r
            JOIN event e ON r.id = e.request
            WHERE r.id = p_request_id
            ORDER BY e.communicated_time ASC
            LIMIT 1
        ) <= p_now THEN
            RETURN;
        END IF;
    
        UPDATE request r
        SET cancelled = true
        WHERE r.id = p_request_id;
    
        SELECT tour INTO v_tour_id
        FROM request
        WHERE id = p_request_id;
    
        SELECT bool_and(cancelled) INTO v_all_requests_cancelled
        FROM request
        WHERE tour = v_tour_id;
    
        IF v_all_requests_cancelled THEN
            UPDATE tour
            SET cancelled = TRUE
            WHERE id = v_tour_id;
        END IF;
    
        UPDATE event e
        SET cancelled = TRUE
        WHERE e.request = p_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}