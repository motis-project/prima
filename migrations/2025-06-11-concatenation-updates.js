import { sql } from 'kysely';

export async function up(db) {
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
                    UPDATE event
                    SET scheduled_time_start = v_time
                    WHERE id = v_event_id;
                ELSE
                    UPDATE event
                    SET scheduled_time_end = v_time
                    WHERE id = v_event_id;
                END IF;
            END LOOP;
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

                UPDATE event e
                SET prev_leg_duration = v_duration
                WHERE e.id = v_event_id;
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

                UPDATE event e
                SET next_leg_duration = v_duration
                WHERE e.id = v_event_id;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
        `.execute(db);
    
    await sql`
        DROP FUNCTION IF EXISTS public.create_and_merge_tours(
            public.request_type,
            public.event_type,
            public.event_type,
            integer[],
            public.tour_type,
            jsonb,
            jsonb,
            jsonb,
            public.direct_duration_type,
            public.direct_duration_type
        );
    `.execute(db);

    await sql`
        CREATE OR REPLACE FUNCTION create_and_merge_tours(
            p_request request_type,
            p_event1 event_type,
            p_event2 event_type,
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
        BEGIN
            CALL update_direct_duration(p_update_direct_duration_dropoff);
            IF p_tour.id IS NULL THEN
                    CALL insert_tour(p_tour, v_tour_id);
            ELSE
                v_tour_id := p_tour.id;
                CALL merge_tours(p_merge_tour_list, v_tour_id, p_tour.arrival, p_tour.departure);
                CALL update_direct_duration(p_update_direct_duration_pickup);
            END IF;
            CALL insert_request(p_request, v_tour_id, v_request_id);
            CALL insert_event(p_event1, v_request_id);
            CALL insert_event(p_event2, v_request_id);
            CALL update_scheduled_times(p_update_scheduled_times);

            CALL update_prev_leg_durations(p_prev_leg_updates);
            CALL update_next_leg_durations(p_next_leg_updates);

            RETURN v_request_id;
        END;
        $$ LANGUAGE plpgsql;
        `.execute(db);
    
    await sql`
        DROP PROCEDURE IF EXISTS public.merge_tours(
            INTEGER[],
            INTEGER,
            BIGINT,
            BIGINT
        );
    `.execute(db);

    await sql`
        CREATE OR REPLACE PROCEDURE merge_tours(p_merge_tour_list INTEGER[], p_target_tour_id INTEGER, p_arrival BIGINT, p_departure BIGINT) AS $$
        BEGIN
        	UPDATE request
        	SET tour = p_target_tour_id
        	WHERE tour = ANY(p_merge_tour_list);

        	UPDATE tour
        	SET 
        		arrival = CASE WHEN p_arrival IS NOT NULL THEN p_arrival ELSE arrival END,
        		departure = CASE WHEN p_departure IS NOT NULL THEN p_departure ELSE departure END
        	WHERE id = p_target_tour_id;

        	DELETE FROM tour
        	WHERE id = ANY(p_merge_tour_list);
        END;
        $$ LANGUAGE plpgsql;
        `.execute(db);
}

export async function down() {
}