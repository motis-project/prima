import { exec } from 'child_process';
import path from 'path';

const BACKUP_DIR = './scripts/simulation/backups/';

const dbUrl = 'postgresql://postgres:pw@localhost:6500/prima';
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;

export async function doBackup(counter: number) {
	const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
	const FILE_NAME = `full_backup_${timestamp}${counter}.sql`;
	const BACKUP_FILE_PATH = path.join(BACKUP_DIR, FILE_NAME);
	const command = `PGPASSWORD=${dbPassword} pg_dump --dbname=${dbUrl} --username=${dbUser} --no-password --format=plain --file="${BACKUP_FILE_PATH}"`;
	await new Promise<void>((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error during backup: ${error.message}`);
				return reject(error);
			}
			if (stdout) {
				console.log(`Backup stdout: ${stdout}`);
			}
			if (stderr) console.warn(`Backup stderr: ${stderr}`);
			console.log(`Full backup successful! Backup saved to ${BACKUP_FILE_PATH}`);
			resolve();
		});
	});
}
