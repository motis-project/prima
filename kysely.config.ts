import { PostgresDialect } from 'kysely';
import { defineConfig } from 'kysely-ctl';
import pg from 'pg';

export const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL
});

export const dialect = new PostgresDialect({ pool });

export default defineConfig({
	dialect,
	migrations: { allowJS: true }
});
