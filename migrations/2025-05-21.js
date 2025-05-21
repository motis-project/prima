import { sql } from 'kysely';

export async function up(db) {
	await db.schema
		.alterTable('request')
		.addColumn('ticket_price', 'integer', (col) => col.notNull().defaultTo(0))
		.execute();
	await sql`ALTER TYPE request_type ADD ATTRIBUTE ticket_price INTEGER;`.execute(db);
	await sql`
			CREATE OR REPLACE PROCEDURE insert_request(
				p_request request_type,
				p_tour_id INTEGER,
				OUT v_request_id INTEGER
			) AS $$
			BEGIN
				INSERT INTO request (passengers, wheelchairs, bikes, luggage, customer, tour, ticket_code, ticket_checked, ticket_price, cancelled, kids_zero_to_two, kids_three_to_four, kids_five_to_six)
				VALUES (p_request.passengers, p_request.wheelchairs, p_request.bikes, p_request.luggage, p_request.customer, p_tour_id, md5(random()::text), FALSE, p_request.ticket_price, FALSE, p_request.kids_zero_to_two, p_request.kids_three_to_four, p_request.kids_five_to_six)
				RETURNING id INTO v_request_id;
			END;
			$$ LANGUAGE plpgsql;
		`.execute(db);
}

export async function down() { }