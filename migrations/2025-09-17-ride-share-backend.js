import { sql } from 'kysely';

export async function up(db) {
    await db.schema
        .createTable('ride_share_tour')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('passengers', 'integer')
        .addColumn('luggage', 'integer')
        .addColumn('scheduled_start_time', 'bigint')
        .addColumn('scheduled_end_time', 'bigint')
        .addColumn('communicated_start_time', 'bigint')
        .addColumn('communicated_end_time', 'bigint')
        .addColumn('fare', 'integer')
        .addColumn('cancelled', 'boolean', (col) => col.notNull())
        .addColumn('message', 'varchar')
        .addColumn('provider', 'integer', (col) => col.references('user.id').notNull())
        .execute();

    await db.schema
        .alterTable('request')
        .alterColumn('tour', (col) => col.dropNotNull())
        .addColumn('ride_share_tour', 'integer', (col) => col.references('ride_share_tour.id'))
        .addColumn('pending', 'boolean', (col) => col.notNull().defaultTo(false))
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
                    p_request request_type,
                    p_tour_id INTEGER,
                    OUT v_request_id INTEGER
                ) AS $$
                BEGIN
                    INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, ride_share_tour, ticket_code, ticket_checked, ticket_price, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six, pending)
                    VALUES (p_request.passengers, p_request.wheelchairs, p_request.bikes, p_request.luggage, p_request.customer, p_tour_id, p_request.ticket_code, FALSE, p_request.ticket_price, FALSE, p_request.kids_zero_to_two, p_request.kids_three_to_four, p_request.kids_five_to_six, true)
                    RETURNING id INTO v_request_id;
                END;
                $$ LANGUAGE plpgsql;
            `.execute(db);

        await sql`
    CREATE OR REPLACE FUNCTION add_ride_share_request(
    	p_request request_type,
    	p_event1 event_type,
    	p_event2 event_type,
        p_tour_id integer,
        p_update_scheduled_times jsonb,
        p_prev_leg_updates jsonb,
        p_next_leg_updates jsonb
    ) RETURNS INTEGER AS $$
    DECLARE
    	v_request_id INTEGER;
        v_event_group_id_1 INTEGER;
        v_event_group_id_2 INTEGER;
    BEGIN
    	CALL update_next_leg_durations(p_next_leg_updates);
    	CALL update_prev_leg_durations(p_prev_leg_updates);
    	CALL insert_request_ride_share(p_request, p_tour_id, v_request_id);
        
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
}

export async function down() { }
