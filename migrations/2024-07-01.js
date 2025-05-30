import { sql } from 'kysely';

export async function up(db) {
	await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
	await sql`
		CREATE TABLE zone(
			id SERIAL PRIMARY KEY,
			area geography(MULTIPOLYGON,4326) NOT NULL,
			name varchar NOT NULL
		)`.execute(db);


	await db.schema
		.createTable('company')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('lat', 'real')
		.addColumn('lng', 'real')
		.addColumn('name', 'varchar')
		.addColumn('address', 'varchar')
		.addColumn('zone', 'integer', (col) => col.references('zone.id'))
		.execute();

	await db.schema
		.createTable('user')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull())
		.addColumn('email', 'varchar', (col) => col.unique())
		.addColumn('password_hash', 'varchar', (col) => col.notNull())
		.addColumn('is_taxi_owner', 'boolean', (col) => col.notNull())
		.addColumn('is_admin', 'boolean', (col) => col.notNull())
		.addColumn('is_email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
		.addColumn('email_verification_code', 'varchar')
		.addColumn('email_verification_expires_at', 'bigint')
		.addColumn('password_reset_code', 'varchar')
		.addColumn('password_reset_expires_at', 'bigint')
		.addColumn('phone', 'varchar')
		.addColumn('company_id', 'integer', (col) => col.references('company.id'))
		.execute();

	await db.schema
		.createTable('session')
		.addColumn('id', 'varchar', (col) => col.primaryKey())
		.addColumn('expires_at', 'bigint', (col) => col.notNull())
		.addColumn('user_id', 'integer', (col) =>
			col.references('user.id').onDelete('cascade').notNull()
		)
		.execute();

	await db.schema
		.createTable('vehicle')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('license_plate', 'varchar', (col) => col.notNull().unique())
		.addColumn('company', 'integer', (col) => col.references('company.id').notNull())
		.addColumn('passengers', 'integer', (col) => col.notNull())
		.addColumn('wheelchairs', 'integer', (col) => col.notNull())
		.addColumn('bikes', 'integer', (col) => col.notNull())
		.addColumn('luggage', 'integer', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('availability')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('start_time', 'bigint', (col) => col.notNull())
		.addColumn('end_time', 'bigint', (col) => col.notNull())
		.addColumn('vehicle', 'integer', (col) => col.references('vehicle.id').notNull())
		.execute();

	await db.schema
		.createTable('tour')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('departure', 'bigint', (col) => col.notNull())
		.addColumn('arrival', 'bigint', (col) => col.notNull())
		.addColumn('direct_duration', 'integer')
		.addColumn('vehicle', 'integer', (col) =>
			col.references('vehicle.id').notNull()
		)
		.addColumn('fare', 'integer')
		.addColumn('cancelled', 'boolean', (col) => col.notNull())
		.addColumn('message', 'varchar')
		.execute();

	await db.schema
		.createTable('request')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('passengers', 'integer', (col) => col.notNull())
		.addColumn('kids_zero_to_two', 'integer', (col) => col.notNull())
		.addColumn('kids_three_to_four', 'integer', (col) => col.notNull())
		.addColumn('kids_five_to_six', 'integer', (col) => col.notNull())
		.addColumn('wheelchairs', 'integer', (col) => col.notNull())
		.addColumn('bikes', 'integer', (col) => col.notNull())
		.addColumn('luggage', 'integer', (col) => col.notNull())
		.addColumn('tour', 'integer', (col) => col.references('tour.id').notNull())
		.addColumn('customer', 'integer', (col) => col.references('user.id').notNull())
		.addColumn('ticket_code', 'varchar', (col) => col.notNull())
		.addColumn('ticket_checked', 'boolean', (col) => col.notNull())
		.addColumn('cancelled', 'boolean', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('event')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('is_pickup', 'boolean', (col) => col.notNull())
		.addColumn('lat', 'real', (col) => col.notNull())
		.addColumn('lng', 'real', (col) => col.notNull())
		.addColumn('scheduled_time_start', 'bigint', (col) => col.notNull())
		.addColumn('scheduled_time_end', 'bigint', (col) => col.notNull())
		.addColumn('communicated_time', 'bigint', (col) => col.notNull())
		.addColumn('prev_leg_duration', 'integer', (col) => col.notNull())
		.addColumn('next_leg_duration', 'integer', (col) => col.notNull())
		// all successive events taking place at the same physical location share the same event group
		.addColumn('event_group', 'varchar', (col) => col.notNull())
		.addColumn('request', 'integer', (col) => col.references('request.id').notNull())
		.addColumn('address', 'varchar', (col) => col.notNull())
		.addColumn('cancelled', 'boolean', (col) => col.notNull())
		.execute();

	await db.schema
		.createTable('journey')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('json', 'varchar', (col) => col.notNull())
		.addColumn('user', 'integer', (col) => col.references('user.id').notNull())
		.addColumn('request1', 'integer', (col) => col.references('request.id').notNull())
		.addColumn('request2', 'integer', (col) => col.references('request.id'))
		.addColumn('rating', 'integer')
		.addColumn('comment', 'varchar')
		.execute();

	// =======
	// Indices
	// -------
	await sql`CREATE INDEX zone_area_idx ON zone USING GIST(area)`.execute(db);
	await sql`CREATE INDEX availability_vehicle_start_end_time_idx ON availability (vehicle, start_time, end_time)`.execute(db);
	await sql`CREATE INDEX tour_vehicle_departure_arrival_idx ON tour (vehicle, departure, arrival)`.execute(db);


	// =================
	// Stored procedures
	// -----------------
	await sql`
		CREATE TYPE request_type AS (
				passengers INTEGER,
				kids_zero_to_two INTEGER,
				kids_three_to_four INTEGER,
				kids_five_to_six INTEGER,
				wheelchairs INTEGER,
				bikes INTEGER,
				luggage INTEGER,
				customer INTEGER
		);`.execute(db);

	await sql`
		CREATE TYPE tour_type AS (
				departure BIGINT,
				arrival BIGINT,
				vehicle INTEGER,
				direct_duration INTEGER,
				id INTEGER
		);`.execute(db);

	await sql`
			CREATE TYPE event_type AS (
				is_pickup BOOLEAN,
				lat FLOAT,
				lng FLOAT,
				scheduled_time_start BIGINT,
				scheduled_time_end BIGINT,
				communicated_time BIGINT,
				prev_leg_duration INTEGER,
				next_leg_duration INTEGER,
				address TEXT,
				grp TEXT
			);`.execute(db);

	await sql`
		CREATE TYPE direct_duration_type AS (
			tour_id INTEGER,
			duration INTEGER
		);`.execute(db);


	// TODO: check if description correct (previous vs next / direction)
	//
	// Sets event_group for each event.
	//
	// [
	//   {
	//     id: event_id,        // id of the updated event
	//     event_group: UUID,   // - event group of the previous event (if it is at the same location as the new event)
	//                          // - newly generated event group       (if the previous event is not at the same location as the new event)
	//   },
	//   ...
	// ]
	await sql`
		CREATE OR REPLACE PROCEDURE update_event_groups(
			p_updates jsonb
		) AS $$
		BEGIN
			IF jsonb_typeof(p_updates) <> 'array' THEN
				RAISE EXCEPTION 'Input must be a JSON array';
			END IF;
	
			IF EXISTS (
					SELECT 1 
					FROM jsonb_array_elements(p_updates) elem 
					WHERE NOT (
						elem ? 'id' 
						AND elem ? 'event_group' 
						AND jsonb_typeof(elem->'id') = 'number' 
						AND jsonb_typeof(elem->'event_group') = 'string'
					)
			) THEN
					RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "event_group" (string)';
			END IF;
	
			UPDATE event e
			SET event_group = updates.event_group
			FROM (
				SELECT 
					(record->>'id')::INTEGER AS id, 
					(record->>'event_group')::VARCHAR AS event_group
				FROM jsonb_array_elements(p_updates) AS record
			) AS updates
			WHERE e.id = updates.id;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);


	// Same structure as update_event_groups
	await sql`
		CREATE OR REPLACE PROCEDURE update_direct_duration(
			p_direct_duration direct_duration_type
		) AS $$
		BEGIN
			UPDATE tour t
			SET direct_duration = p_direct_duration.duration
			WHERE t.id = p_direct_duration.tour_id;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);

	// Same structure as update_event_groups
	await sql`
	CREATE OR REPLACE PROCEDURE update_next_leg_durations(
		p_next_leg_durations jsonb
	) AS $$
	BEGIN
		IF jsonb_typeof(p_next_leg_durations) <> 'array' THEN
			RAISE EXCEPTION 'Input must be a JSON array';
		END IF;

		IF EXISTS (
			SELECT 1 
			FROM jsonb_array_elements(p_next_leg_durations) elem 
			WHERE NOT (
				elem ? 'id' 
				AND elem ? 'next_leg_duration' 
				AND jsonb_typeof(elem->'id') = 'number' 
				AND jsonb_typeof(elem->'next_leg_duration') = 'number'
			)
		) THEN
			RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "next_leg_duration" (integer)';
		END IF;

		UPDATE event e
		SET next_leg_duration = updates.next_leg_duration
		FROM (
			SELECT 
				(record->>'id')::INTEGER AS id, 
				(record->>'next_leg_duration')::INTEGER AS next_leg_duration
			FROM jsonb_array_elements(p_next_leg_durations) AS record
		) AS updates
		WHERE e.id = updates.id;
	END;
	$$ LANGUAGE plpgsql;
`.execute(db);

	// Same structure as update_event_groups
	await sql`
		CREATE OR REPLACE PROCEDURE update_prev_leg_durations(
			p_prev_leg_durations jsonb
		) AS $$
		BEGIN
			IF jsonb_typeof(p_prev_leg_durations) <> 'array' THEN
				RAISE EXCEPTION 'Input must be a JSON array';
			END IF;

			IF EXISTS (
				SELECT 1 
				FROM jsonb_array_elements(p_prev_leg_durations) elem 
				WHERE NOT (
					elem ? 'id' 
					AND elem ? 'prev_leg_duration' 
					AND jsonb_typeof(elem->'id') = 'number' 
					AND jsonb_typeof(elem->'prev_leg_duration') = 'number'
				)
			) THEN
				RAISE EXCEPTION 'Each JSON object must contain "id" (integer) and "prev_leg_duration" (integer)';
			END IF;

			UPDATE event e
			SET prev_leg_duration = updates.prev_leg_duration
			FROM (
				SELECT 
					(record->>'id')::INTEGER AS id, 
					(record->>'prev_leg_duration')::INTEGER AS prev_leg_duration
				FROM jsonb_array_elements(p_prev_leg_durations) AS record
			) AS updates
			WHERE e.id = updates.id;
		END;
		$$ LANGUAGE plpgsql;
	`.execute(db);

	await sql`
	CREATE OR REPLACE PROCEDURE insert_request(
		p_request request_type,
		p_tour_id INTEGER,
		OUT v_request_id INTEGER
	) AS $$
	BEGIN
		INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, tour, ticket_code, ticket_checked, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six)
		VALUES (p_request.passengers, p_request.wheelchairs, p_request.bikes, p_request.luggage, p_request.customer, p_tour_id, md5(random()::text), FALSE, FALSE, p_request.kids_zero_to_two, p_request.kids_three_to_four, p_request.kids_five_to_six)
		RETURNING id INTO v_request_id;
	END;
	$$ LANGUAGE plpgsql;
`.execute(db);

	await sql`
CREATE OR REPLACE PROCEDURE insert_event(
	p_event event_type,
	p_request_id INTEGER
) AS $$
	BEGIN
		INSERT INTO event (
			is_pickup, lat, lng, scheduled_time_start, scheduled_time_end, communicated_time,
			address, request, prev_leg_duration, next_leg_duration, event_group, cancelled
		)
	VALUES (
		p_event.is_pickup, p_event.lat, p_event.lng, p_event.scheduled_time_start, p_event.scheduled_time_end,
		p_event.communicated_time, p_event.address,
		p_request_id, p_event.prev_leg_duration, p_event.next_leg_duration, p_event.grp, FALSE
	);
END;
$$ LANGUAGE plpgsql;`.execute(db);

	await sql`
CREATE OR REPLACE PROCEDURE merge_tours(p_merge_tour_list INTEGER[], p_target_tour_id INTEGER, p_arrival BIGINT, p_departure BIGINT) AS $$
BEGIN
	UPDATE request
	SET tour = p_target_tour_id
	WHERE tour = ANY(p_merge_tour_list);

	UPDATE event
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


	await sql`
CREATE OR REPLACE PROCEDURE insert_tour(
	p_tour tour_type,
	OUT v_tour_id INTEGER
) AS $$
BEGIN
	INSERT INTO tour (departure, arrival, vehicle, fare, direct_duration, cancelled)
	VALUES (p_tour.departure, p_tour.arrival, p_tour.vehicle, NULL, p_tour.direct_duration, FALSE)
	RETURNING id INTO v_tour_id;
END;
$$ LANGUAGE plpgsql;
`.execute(db);

	await sql`
CREATE OR REPLACE FUNCTION create_and_merge_tours(
	p_request request_type,
	p_event1 event_type,
	p_event2 event_type,
	p_merge_tour_list INTEGER[],
	p_tour tour_type,
	p_update_event_groups jsonb,
	p_update_next_leg_durations jsonb,
	p_update_prev_leg_durations jsonb,
	p_update_direct_duration_dropoff direct_duration_type,
	p_update_direct_duration_pickup direct_duration_type
) RETURNS INTEGER AS $$
DECLARE
	v_request_id INTEGER;
	v_tour_id INTEGER;
BEGIN
	CALL update_event_groups(p_update_event_groups);
	CALL update_direct_duration(p_update_direct_duration_dropoff);
	CALL update_next_leg_durations(p_update_next_leg_durations);
	CALL update_prev_leg_durations(p_update_prev_leg_durations);
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

	RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;
`.execute(db);

	await sql`
CREATE OR REPLACE PROCEDURE cancel_request(
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

	await sql`
CREATE OR REPLACE PROCEDURE cancel_tour(
	p_tour_id INTEGER,
	p_company_id INTEGER,
	p_message VARCHAR
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
		message = p_message
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
}

export async function down() { }
