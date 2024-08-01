import { type Database } from './types';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

console.log('Connecting to dabase: ', process.env.DATABASE_URL);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const dialect = new PostgresDialect({
	pool
});

export const db = new Kysely<Database>({
	dialect
});
