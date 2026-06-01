import { sql } from 'kysely';

export async function up(db) {
    await db.schema
        .alterTable('request')
        .addColumn('cancelled_by_customer', 'boolean', (col) => col.notNull().defaultTo(false))
        .addColumn('cancelled_at', 'bigint')
        .execute();

    await sql`
        CREATE OR REPLACE FUNCTION cancel_request(
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
            SET cancelled = true,
                cancelled_by_customer = true,
                cancelled_at = p_now
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

    await sql`
    CREATE OR REPLACE PROCEDURE cancel_ride_share_request(
    	p_request_id INTEGER,
    	p_user_id INTEGER,
        p_now BIGINT
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
    	SET cancelled = true,
            cancelled_by_customer = true,
            cancelled_at = p_now
    	WHERE r.id = p_request_id;

    	UPDATE event e
    	SET cancelled = TRUE
    	WHERE e.request = p_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await db.schema
        .alterTable('tour')
        .addColumn('cancelled_at', 'bigint')
        .execute();

    await sql`
    CREATE OR REPLACE PROCEDURE cancel_tour(
    	p_tour_id INTEGER,
    	p_company_id INTEGER,
    	p_message VARCHAR,
        p_now BIGINT
    ) AS $$
    BEGIN
    	IF NOT EXISTS (
    	    SELECT 1
    	    FROM tour t
    	    JOIN vehicle v ON v.id = t.vehicle
    	    WHERE t.id = p_tour_id
    	    AND v.company = p_company_id
    	) THEN
    	    RETURN;
    	END IF;

    	UPDATE tour t
    	SET cancelled = TRUE,
    		message = p_message,
            cancelled_at = p_now
    	WHERE t.id = p_tour_id;

    	UPDATE request r
    	SET cancelled = TRUE
    	WHERE r.tour = p_tour_id;

    	UPDATE event e
    	SET cancelled = TRUE
    	WHERE e.request IN (SELECT id FROM request WHERE tour = p_tour_id);
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await db.schema
        .alterTable('ride_share_tour')
        .addColumn('cancelled_at', 'bigint')
        .execute();

    await sql`
        CREATE OR REPLACE PROCEDURE cancel_ride_share_tour(
        	p_tour_id INTEGER,
        	p_user_id INTEGER,
            p_now BIGINT
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
        	SET cancelled = TRUE,
            cancelled_at = p_now
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