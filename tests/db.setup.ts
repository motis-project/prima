import { test as setup } from '@playwright/test';
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from 'kysely';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { dbConfig } from './config';
import * as fs from 'fs';
import type { Database } from '../src/lib/types';

setup('setup db', async () => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const pool = new pg.Pool({ ...dbConfig, database: 'prima' });
	const db = new Kysely<Database>({
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

	await Promise.all([
		db.deleteFrom('zone').execute(),
		db.deleteFrom('company').execute(),
		db.deleteFrom('vehicle').execute(),
		db.deleteFrom('tour').execute(),
		db.deleteFrom('availability').execute(),
		db.deleteFrom('auth_user').execute(),
		db.deleteFrom('user_session').execute(),
		db.deleteFrom('event').execute(),
		db.deleteFrom('address').execute(),
		db.deleteFrom('request').execute()
	]);

	const zonesSqlPath = path.join(__dirname, '../test_data/default/zone.sql');
	const zonesQuery = fs.readFileSync(zonesSqlPath).toString();
	await pool.query(zonesQuery);

	await sleep(1000);
});

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
