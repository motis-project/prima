import { test as setup } from '@playwright/test';
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { dbConfig } from './config';
import * as fs from 'fs';

setup('setup db', async () => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const adminDb = new Kysely<unknown>({
		dialect: new PostgresDialect({
			pool: new pg.Pool(dbConfig)
		})
	});
	await sql`drop database if exists prima with (force)`.execute(adminDb);
	await sql`create database prima`.execute(adminDb);
	await adminDb.destroy();
	console.log('prima database dropped & created');

	const pool = new pg.Pool({ ...dbConfig, database: 'prima' });
	const db = new Kysely<unknown>({
		dialect: new PostgresDialect({
			pool: pool
		})
	});
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs: fsp,
			path,
			migrationFolder: path.join(__dirname, '../migrations')
		})
	});

	await migrator.migrateToLatest();
	console.log('migrations finished');

	const zonesSqlPath = path.join(__dirname, '../test_data/default/zone.sql');
	const zonesQuery = fs.readFileSync(zonesSqlPath).toString();
	await pool.query(zonesQuery);
	console.log('zones added');
});
