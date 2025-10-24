import { sql } from 'kysely';

export async function up(db) {
    await sql`
    CREATE OR REPLACE PROCEDURE update_event(
        p_id integer,
        p_event event_type
    ) AS $$
     DECLARE
        grp integer;
        old_grp integer;
     BEGIN
        IF p_event.grp IS NOT NULL THEN
            grp := p_event.grp;
            old_grp := (
                SELECT event_group_id
                FROM event
                WHERE id = p_id
            );

            UPDATE event e
            SET event_group_id = grp
            WHERE e.id = p_id;

            UPDATE event_group eg
            SET prev_leg_duration = (
                SELECT prev_leg_duration
                FROM event_group
                WHERE id = old_grp
            )
            WHERE id = grp;

            UPDATE event_group eg
            SET next_leg_duration = (
                SELECT next_leg_duration
                FROM event_group
                WHERE id = old_grp
            )
            WHERE id = grp;

        ELSE
            SELECT event_group_id INTO grp
            FROM event
            WHERE id = p_id;
        END IF;

        UPDATE event_group eg
        SET scheduled_time_start = p_event.scheduled_time_start
        WHERE id = grp;

        UPDATE event_group eg
        SET scheduled_time_end = p_event.scheduled_time_end
        WHERE id = grp;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down() { }
