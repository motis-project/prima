import { sql } from 'kysely';

export async function up(db) {
	await db.schema
		.createTable('event_group')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('lat', 'double precision', (col) => col.notNull())
		.addColumn('lng', 'double precision', (col) => col.notNull())
		.addColumn('scheduled_time_start', 'bigint', (col) => col.notNull())
		.addColumn('scheduled_time_end', 'bigint', (col) => col.notNull())
		.addColumn('prev_leg_duration', 'integer', (col) => col.notNull())
		.addColumn('next_leg_duration', 'integer', (col) => col.notNull())
		.addColumn('address', 'varchar', (col) => col.notNull())
		.addColumn('request', 'integer')
		.addColumn('is_pickup', 'boolean')
		.execute();

    await db.schema
        .alterTable('event')
		.addColumn('event_group_id', 'integer')
        .execute();

    await db
        .insertInto('event_group')
        .columns(['lat', 'lng', 'scheduled_time_start', 'scheduled_time_end', 'prev_leg_duration', 'next_leg_duration', 'address', 'request', 'is_pickup'])
        .expression(
        db
            .selectFrom('event')
            .select(['lat', 'lng', 'scheduled_time_start', 'scheduled_time_end', 'prev_leg_duration', 'next_leg_duration', 'address', 'request', 'is_pickup'])
        )
        .execute();

    await sql`
        UPDATE event
        SET event_group_id = event_group.id
        FROM event_group
        WHERE event.request = event_group.request
        AND event.is_pickup = event_group.is_pickup
    `.execute(db);

    await db.schema
        .alterTable('event')
        .addForeignKeyConstraint(
            'event_group_id_fk',
            ['event_group_id'],
            'event_group',
            ['id']
        )
        .execute();

    await db.schema
        .alterTable('event_group')
        .dropColumn('is_pickup')
        .dropColumn('request')
        .execute();

    await db.schema
        .alterTable('event')
        .alterColumn('event_group_id', col => col.setNotNull())
        .dropColumn('lat')
        .dropColumn('lng')
        .dropColumn('scheduled_time_start')
        .dropColumn('scheduled_time_end')
        .dropColumn('prev_leg_duration')
        .dropColumn('next_leg_duration')
        .dropColumn('address')
        .dropColumn('event_group')
        .execute();

    await sql`
    CREATE TYPE event_type_v2 AS (
        is_pickup BOOLEAN,
        lat FLOAT,
        lng FLOAT,
        scheduled_time_start BIGINT,
        scheduled_time_end BIGINT,
        communicated_time BIGINT,
        prev_leg_duration INTEGER,
        next_leg_duration INTEGER,
        address TEXT,
        grp INTEGER
    );
    `.execute(db);

    await sql`
        DROP PROCEDURE IF EXISTS insert_event(event_type, INTEGER);
    `.execute(db);

    await sql`
    CREATE PROCEDURE create_event_group(
        p_event event_type_v2,
	    OUT v_event_group_id INTEGER
    ) AS $$
    BEGIN
        INSERT INTO event_group (
            lat, lng, scheduled_time_start, scheduled_time_end,
            address, prev_leg_duration, next_leg_duration
        )
        VALUES (
            p_event.lat, p_event.lng, p_event.scheduled_time_start, p_event.scheduled_time_end,
            p_event.address, p_event.prev_leg_duration, p_event.next_leg_duration
        )
        RETURNING id INTO v_event_group_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
    CREATE PROCEDURE insert_event(
        p_event event_type_v2,
        p_request_id INTEGER,
        p_event_group INTEGER
    ) AS $$
    BEGIN
        INSERT INTO event (
            is_pickup, request, event_group_id, cancelled, communicated_time
        )
        VALUES (
            p_event.is_pickup, p_request_id, p_event_group, FALSE, p_event.communicated_time
        );
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
    CREATE OR REPLACE PROCEDURE update_event_group(
        p_event event_type_v2
    ) AS $$
    BEGIN
        UPDATE event_group e
        SET
            scheduled_time_start = p_event.scheduled_time_start,
            scheduled_time_end = p_event.scheduled_time_end
        WHERE e.id = p_event.grp;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
    CREATE OR REPLACE PROCEDURE update_prev_leg_durations(
        p_prev_leg_durations jsonb
    ) AS $$
    DECLARE
        v_duration BIGINT;
        v_item jsonb;
        v_event_id INTEGER;
    BEGIN
        IF jsonb_typeof(p_prev_leg_durations) <> 'array' THEN
			RAISE EXCEPTION 'Input must be a JSON array';
		END IF;

		IF EXISTS (
			SELECT 1 
			FROM jsonb_array_elements(p_prev_leg_durations) elem 
			WHERE NOT (
				elem ? 'event' 
				AND elem ? 'duration' 
				AND jsonb_typeof(elem->'event') = 'number' 
				AND jsonb_typeof(elem->'duration') = 'number'
			)
		) THEN
			RAISE EXCEPTION 'Each JSON object must contain "event" (integer) and "duration" (integer)';
		END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_prev_leg_durations)
        LOOP
            v_event_id := (v_item ->> 'event')::INTEGER;
            v_duration := (v_item ->> 'duration')::BIGINT;
            UPDATE event_group e
            SET prev_leg_duration = v_duration
            WHERE id = (
                SELECT event_group_id
                FROM event
                WHERE id = v_event_id
            );
        END LOOP;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
        CREATE OR REPLACE PROCEDURE update_next_leg_durations(
            p_next_leg_durations jsonb
        ) AS $$
        DECLARE
            v_duration BIGINT;
            v_item jsonb;
            v_event_id INTEGER;
        BEGIN
            IF jsonb_typeof(p_next_leg_durations) <> 'array' THEN
				RAISE EXCEPTION 'Input must be a JSON array';
			END IF;

			IF EXISTS (
				SELECT 1 
				FROM jsonb_array_elements(p_next_leg_durations) elem 
				WHERE NOT (
					elem ? 'event' 
					AND elem ? 'duration' 
					AND jsonb_typeof(elem->'event') = 'number' 
					AND jsonb_typeof(elem->'duration') = 'number'
				)
			) THEN
				RAISE EXCEPTION 'Each JSON object must contain "event" (integer) and "duration" (integer)';
			END IF;
            FOR v_item IN SELECT * FROM jsonb_array_elements(p_next_leg_durations)
            LOOP
                v_event_id := (v_item ->> 'event')::INTEGER;
                v_duration := (v_item ->> 'duration')::BIGINT;

                UPDATE event_group e
                SET next_leg_duration = v_duration
                WHERE id = (
                    SELECT event_group_id
                    FROM event
                    WHERE id = v_event_id
                );
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        `.execute(db);

    await sql`
        CREATE OR REPLACE PROCEDURE update_scheduled_times(
            p_update_scheduled_times jsonb
        ) AS $$
        DECLARE
            record jsonb;
            v_event_id INTEGER;
            v_time BIGINT;
            v_start BOOLEAN;
        BEGIN
            FOR record IN SELECT * FROM jsonb_array_elements(p_update_scheduled_times)
            LOOP
                v_event_id := (record->>'event_id')::INTEGER;
                v_time := (record->>'time')::BIGINT;
                v_start := (record->>'start')::BOOLEAN;

                IF v_start THEN
                    UPDATE event_group e
                    SET scheduled_time_start = v_time
                    WHERE id = (
                        SELECT event_group_id
                        FROM event
                        WHERE id = v_event_id
                    );
                ELSE
                    UPDATE event_group e
                    SET scheduled_time_end = v_time
                    WHERE id = (
                        SELECT event_group_id
                        FROM event
                        WHERE id = v_event_id
                    );
                END IF;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        `.execute(db);

    await sql`
    DROP FUNCTION IF EXISTS public.create_and_merge_tours(
        request_type,
        event_type,
        event_type,
        integer[],
        tour_type,
        direct_duration_type,
        direct_duration_type,
        jsonb,
        jsonb,
        jsonb
    );
    `.execute(db);

    await sql`
    CREATE OR REPLACE FUNCTION create_and_merge_tours(
    	p_request request_type,
    	p_event1 event_type_v2,
    	p_event2 event_type_v2,
    	p_merge_tour_list INTEGER[],
        p_tour tour_type,
        p_update_direct_duration_dropoff direct_duration_type,
        p_update_direct_duration_pickup direct_duration_type,
        p_update_scheduled_times jsonb,
        p_prev_leg_updates jsonb,
        p_next_leg_updates jsonb
    ) RETURNS INTEGER AS $$
    DECLARE
    	v_request_id INTEGER;
    	v_tour_id INTEGER;
        v_event_group_id_1 INTEGER;
        v_event_group_id_2 INTEGER;
    BEGIN
    	CALL update_direct_duration(p_update_direct_duration_dropoff);
    	CALL update_next_leg_durations(p_next_leg_updates);
    	CALL update_prev_leg_durations(p_prev_leg_updates);
    	IF p_tour.id IS NULL THEN
    		CALL insert_tour(p_tour, v_tour_id);
    	ELSE
    		v_tour_id := p_tour.id;
    		CALL merge_tours(p_merge_tour_list, v_tour_id, p_tour.arrival, p_tour.departure);
    		CALL update_direct_duration(p_update_direct_duration_pickup);
    	END IF;
    	CALL insert_request(p_request, v_tour_id, v_request_id);
        
        IF p_event1.grp IS NULL THEN
            CALL create_event_group(p_event1, v_event_group_id_1);
        ELSE
            CALL update_event_group(p_event1);
            v_event_group_id_1 := p_event1.grp;
        END IF;
        IF p_event2.grp IS NULL THEN
            CALL create_event_group(p_event2, v_event_group_id_2);
        ELSE
            CALL update_event_group(p_event2);
            v_event_group_id_2 := p_event2.grp;
        END IF;
    	CALL insert_event(p_event1, v_request_id, v_event_group_id_1);
    	CALL insert_event(p_event2, v_request_id, v_event_group_id_2);

        CALL update_scheduled_times(p_update_scheduled_times);
    	RETURN v_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`DROP TYPE IF EXISTS event_type;`.execute(db);
    await sql`ALTER TYPE event_type_v2 RENAME TO event_type;`.execute(db);

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

export async function down() { }
