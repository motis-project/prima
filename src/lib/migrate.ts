import * as path from 'path';
import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider, Kysely } from 'kysely';
import { db } from './database';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Database } from './types';

export async function migrateToLatest(db: Kysely<Database>) {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(__dirname, '../../migrations')
		})
	});

	const { error, results } = await migrator.migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`failed to execute migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('failed to migrate');
		console.error(error);
		process.exit(1);
	}
}
