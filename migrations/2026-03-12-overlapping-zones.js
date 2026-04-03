import { sql } from 'kysely';

export async function up(db) {
  await sql`
    ALTER TABLE zone
    ADD COLUMN expanded geography(MULTIPOLYGON, 4326)
  `.execute(db);
}

export async function down() { }
