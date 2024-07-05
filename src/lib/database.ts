import { type Database } from './types';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

export const pool = new pg.Pool({
	database: 'prima',
	host: 'localhost',
	user: 'postgres',
	password: 'pw',
	port: 6500,
	max: 10
});

const dialect = new PostgresDialect({
	pool
});

export const db = new Kysely<Database>({
	dialect
});
