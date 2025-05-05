import { exec } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { mkdirSync, existsSync } from 'fs';

config();

const BACKUP_DIR = '/app/db_backups';

if (!existsSync(BACKUP_DIR)) {
	mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL_INTERNAL;
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;
const targetDatabase = process.env.POSTGRES_DB || 'prima';

const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
const FILE_NAME = `full_backup_${timestamp}.sql`;
const BACKUP_FILE_PATH = path.join(BACKUP_DIR, FILE_NAME);

const command = `PGPASSWORD=${dbPassword} pg_dump --dbname=${dbUrl} --username=${dbUser} --no-password --format=plain --file="${BACKUP_FILE_PATH}"`;

console.log(`Starting full backup for database "${targetDatabase}"...`);

exec(command, (error, _, stderr) => {
	if (error) {
		console.error(`Error during backup: ${error.message}`);
		return;
	}
	if (stderr) {
		console.warn(`Backup stderr: ${stderr}`);
	}
	console.log(`Full backup successful! Backup saved to ${BACKUP_FILE_PATH}`);
});
