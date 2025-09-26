import { sql } from 'kysely';

export async function up(db) {
	await sql`
		CREATE TYPE ride_share_request_type AS (
				passengers INTEGER,
				luggage INTEGER,
				customer INTEGER,
                bus_stop_time bigint,
                requested_time bigint,
                start_fixed boolean
		);`.execute(db);

    await db.schema
        .createTable('ride_share_vehicle')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('passengers', 'integer', (col) => col.notNull())
        .addColumn('luggage', 'integer', (col) => col.notNull())
        .addColumn('color', 'varchar', (col) => col.notNull())
        .addColumn('model', 'varchar', (col) => col.notNull())
        .addColumn('smoking_allowed', 'boolean', (col) => col.notNull())
        .addColumn('owner', 'integer', (col) => col.references('user.id').notNull())
        .execute();

    await db.schema
        .createTable('ride_share_tour')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('passengers', 'integer')
        .addColumn('luggage', 'integer')
        .addColumn('cancelled', 'boolean', (col) => col.notNull())
        .addColumn('vehicle', 'integer', (col) => col.references('ride_share_vehicle.id').notNull())
        .execute();

    await db.schema
        .alterTable('request')
        .alterColumn('tour', (col) => col.dropNotNull())
        .addColumn('ride_share_tour', 'integer', (col) => col.references('ride_share_tour.id'))
        .addColumn('start_fixed', 'boolean')
        .addColumn('bus_stop_time', 'bigint')
        .addColumn('requested_time', 'bigint')
        .addColumn('pending', 'boolean', (col) => col.notNull())
        .execute();

    await sql`
                CREATE OR REPLACE PROCEDURE insert_request(
                    p_request request_type,
                    p_tour_id INTEGER,
                    OUT v_request_id INTEGER
                ) AS $$
                BEGIN
                    INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, tour, ticket_code, ticket_checked, ticket_price, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six, pending)
                    VALUES (p_request.passengers, p_request.wheelchairs, p_request.bikes, p_request.luggage, p_request.customer, p_tour_id, p_request.ticket_code, FALSE, p_request.ticket_price, FALSE, p_request.kids_zero_to_two, p_request.kids_three_to_four, p_request.kids_five_to_six, false)
                    RETURNING id INTO v_request_id;
                END;
                $$ LANGUAGE plpgsql;
            `.execute(db);

    await sql`
                CREATE OR REPLACE PROCEDURE insert_request_ride_share(
                    p_request ride_share_request_type,
                    p_tour_id INTEGER,
                    OUT v_request_id INTEGER
                ) AS $$
                BEGIN
                    INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, ride_share_tour, ticket_checked, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six, pending, bus_stop_time, requested_time, start_fixed, ticket_code)
                    VALUES (p_request.passengers, 0, 0, p_request.luggage, p_request.customer, p_tour_id, FALSE, FALSE, 0, 0, 0, true, p_request.bus_stop_time, p_request.requested_time, p_request.start_fixed, '')
                    RETURNING id INTO v_request_id;
                END;
                $$ LANGUAGE plpgsql;
            `.execute(db);

        await sql`
    CREATE OR REPLACE FUNCTION add_ride_share_request(
    	p_request ride_share_request_type,
    	p_event1 event_type,
    	p_event2 event_type,
        p_tour_id integer
    ) RETURNS INTEGER AS $$
    DECLARE
    	v_request_id INTEGER;
        v_event_group_id_1 INTEGER;
        v_event_group_id_2 INTEGER;
    BEGIN
    	CALL insert_request_ride_share(p_request, p_tour_id, v_request_id);
        CALL create_event_group(p_event1, v_event_group_id_1);
        CALL create_event_group(p_event2, v_event_group_id_2);
    	CALL insert_event(p_event1, v_request_id, v_event_group_id_1);
    	CALL insert_event(p_event2, v_request_id, v_event_group_id_2);
    	RETURN v_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);


    await sql`
    CREATE OR REPLACE PROCEDURE update_event(
        p_id integer,
    	p_event event_type
    ) AS $$
     BEGIN
    	UPDATE event_group eg
    	SET scheduled_time_start = p_event.scheduled_time_start
    	WHERE id = (
                SELECT event_group_id
                FROM event
                WHERE id = p_id
        );

    	UPDATE event_group eg
    	SET scheduled_time_end = p_event.scheduled_time_end
    	WHERE id = (
                SELECT event_group_id
                FROM event
                WHERE id = p_id
        );
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);

        await sql`
    CREATE OR REPLACE PROCEDURE accept_ride_share_request(
    	p_request_id integer,
    	p_event1 event_type,
    	p_event2 event_type,
        p_event_id1 integer,
        p_event_id2 integer,
        p_update_scheduled_times jsonb,
        p_prev_leg_updates jsonb,
        p_next_leg_updates jsonb
    ) AS $$
    BEGIN
    	CALL update_next_leg_durations(p_next_leg_updates);
    	CALL update_prev_leg_durations(p_prev_leg_updates);
        CALL update_scheduled_times(p_update_scheduled_times);

        CALL update_event(p_event_id1, p_event1);
        CALL update_event(p_event_id2, p_event2);

    	UPDATE request r
    	SET pending = false
    	WHERE r.id = p_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down() { }
