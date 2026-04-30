import { sql } from 'kysely';

export async function up(db) {
    await sql`
    CREATE OR REPLACE PROCEDURE cancel_ride_share_request_by_provider(
        p_request_id INTEGER,
        p_customer_id INTEGER,
        p_provider_id INTEGER,
        p_now BIGINT
    ) AS  $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
                FROM request r
                INNER JOIN ride_share_tour as rst on r.ride_share_tour=rst.id
                INNER JOIN ride_share_vehicle as v on rst.vehicle=v.id
                WHERE r.customer = p_customer_id
                AND r.id = p_request_id
                AND v.owner=p_provider_id
        ) THEN
            RETURN;
        END IF;

        UPDATE request r
        SET cancelled = true,
            cancelled_by_customer = false,
            cancelled_at = p_now
        WHERE r.id = p_request_id;

        UPDATE event e
        SET cancelled = TRUE
        WHERE e.request = p_request_id;
    END;
    $$ LANGUAGE plpgsql;
    `.execute(db);
}

export async function down() { }