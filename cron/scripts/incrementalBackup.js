import { config } from 'dotenv';
import { exec } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';

config();

const BACKUP_DIR = './db_backups';

const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
const FILE_NAME = `incremental_backup_${timestamp}.sql`;
const OUTPUT_PATH = path.join(BACKUP_DIR, FILE_NAME);

if (!existsSync(BACKUP_DIR)) {
	mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL_INTERNAL;
if (!dbUrl) {
	throw new Error('DATABASE_URL is not set in the environment.');
}

const command = `pg_dump --dbname=${dbUrl} --format=plain --no-owner --file="${OUTPUT_PATH}"`;

console.log(`Starting incremental backup: ${OUTPUT_PATH}`);

exec(command, (error, _, stderr) => {
	if (error) {
		console.error(`Backup failed: ${error.message}`);
		return;
	}
	if (stderr) {
		console.warn(`Warning during backup: ${stderr}`);
	}
	console.log(`Incremental backup saved at: ${OUTPUT_PATH}`);
});
