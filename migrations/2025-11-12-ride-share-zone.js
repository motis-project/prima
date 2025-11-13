import { sql } from 'kysely';

export async function up(db) {
    await sql`
    CREATE TABLE ride_share_zone(
        id SERIAL PRIMARY KEY,
        area geography(MULTIPOLYGON,4326) NOT NULL,
        name varchar NOT NULL
    )`.execute(db);
}

export async function down() { }