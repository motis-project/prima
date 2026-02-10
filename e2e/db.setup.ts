import { test as setup } from '@playwright/test';
import { CamelCasePlugin, FileMigrationProvider, Kysely, Migrator, PostgresDialect } from 'kysely';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { dbConfig } from './config.ts';
import * as fs from 'fs';
import type { Database } from '../src/lib/server/db';

setup('setup db', async () => {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const pool = new pg.Pool({ ...dbConfig, database: 'prima' });
	const db = new Kysely<Database>({
		plugins: [new CamelCasePlugin()],
		dialect: new PostgresDialect({ pool: pool })
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

	await db.deleteFrom('journey').executeTakeFirstOrThrow();
	await db.deleteFrom('availability').executeTakeFirstOrThrow();
	await db.deleteFrom('event').executeTakeFirstOrThrow();
	await db.deleteFrom('eventGroup').executeTakeFirstOrThrow();
	await db.deleteFrom('rideShareRating').executeTakeFirstOrThrow();
	await db.deleteFrom('request').executeTakeFirstOrThrow();
	await db.deleteFrom('tour').executeTakeFirstOrThrow();
	await db.deleteFrom('rideShareTour').executeTakeFirstOrThrow();
	await db.deleteFrom('rideShareVehicle').executeTakeFirstOrThrow();
	await db.deleteFrom('vehicle').executeTakeFirstOrThrow();
	await db.deleteFrom('session').executeTakeFirstOrThrow();
	await db.deleteFrom('user').executeTakeFirstOrThrow();
	await db.deleteFrom('company').executeTakeFirstOrThrow();
	await db.deleteFrom('zone').executeTakeFirstOrThrow();

	const zonesSqlPath = path.join(__dirname, '../data/zone.sql');
	const zonesQuery = fs.readFileSync(zonesSqlPath).toString();
	await pool.query(zonesQuery);

	const updateSqlPath = path.join(__dirname, '../data/expandWeißwasser.sql');
	const updateQuery = fs.readFileSync(updateSqlPath).toString();
	await pool.query(updateQuery);

	await sleep(1000);
});

function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
