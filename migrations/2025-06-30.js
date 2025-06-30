import { sql } from 'kysely';

export async function up(db) {
	await db.schema
		.alterTable('request')
		.addColumn('created_at', 'timestamp', (col) => col)
		.execute();
	await sql`ALTER TABLE request ALTER COLUMN created_at SET DEFAULT now();`.execute(db);
	await db.schema
		.alterTable('user')
		.addColumn('first_name', 'varchar', (col) => col.notNull().defaultTo(""))
		.addColumn('gender', 'varchar', (col) => col)
		.addColumn('zip_code', 'varchar', (col) => col.notNull().defaultTo(""))
		.addColumn('city', 'varchar', (col) => col.notNull().defaultTo(""))
		.execute();
}

export async function down() { }