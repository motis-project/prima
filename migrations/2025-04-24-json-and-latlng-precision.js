import { sql } from 'kysely';

export async function up(db) {
    await sql`
        ALTER TABLE "journey" ALTER COLUMN "json" TYPE JSONB USING "json"::JSONB
    `.execute(db);
      
    db.schema
        .alterTable("event")
        .alterColumn("lat", (col) => col.setDataType(sql`double precision`))
        .execute();
    db.schema
        .alterTable("event")
        .alterColumn("lng", (col) => col.setDataType(sql`double precision`))
        .execute();
}
