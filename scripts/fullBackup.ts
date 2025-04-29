import { exec } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';

config();

const BACKUP_DIR = './db_backups';

if (!existsSync(BACKUP_DIR)) {
	mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL;
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
	cleanupOldBackups();
});

function cleanupOldBackups() {
	try {
		const files = readdirSync(BACKUP_DIR);

		const fullBackups = files
			.filter((f) => f.startsWith('full_backup_') && f.endsWith('.sql'))
			.sort();

		const incrementalBackups = files
			.filter((f) => f.startsWith('incremental_backup_') && f.endsWith('.sql'))
			.sort();

		const backupsToDelete = fullBackups.slice(0, -2);
		backupsToDelete.forEach((file) => {
			unlinkSync(path.join(BACKUP_DIR, file));
			console.log(`Deleted old full backup: ${file}`);
		});

		const secondNewest = fullBackups.length >= 2 ? fullBackups[fullBackups.length - 2] : null;
		const cutoffTimestamp = secondNewest ? extractTimestamp(secondNewest) : null;

		if (cutoffTimestamp) {
			incrementalBackups
				.filter((f) => extractTimestamp(f) < cutoffTimestamp)
				.forEach((f) => {
					unlinkSync(path.join(BACKUP_DIR, f));
					console.log(`Deleted outdated incremental backup: ${f}`);
				});
		}

		console.log('Old backups cleaned up successfully.');
	} catch (err) {
		console.error('Error cleaning up old backups:', err);
	}
}

function extractTimestamp(filename: string): string {
	const match = filename.match(/_(\d{4}_\d{2}_\d{2}_\d{2}_\d{2})/);
	return match ? match[1] : '';
}
