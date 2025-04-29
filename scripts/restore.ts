import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = new URL('.', import.meta.url).pathname;

const BACKUP_FOLDER = path.join(__dirname, '..', 'db_backups');

const DATABASE_URL = process.env.DATABASE_URL;
const PGPASSWORD = process.env.PGPASSWORD;

const executeCommand = (command: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(`Error: ${stderr || stdout}`);
			} else {
				resolve();
			}
		});
	});
};

const restoreFullBackup = async (fullBackupFile: string) => {
	const fullBackupPath = path.join(BACKUP_FOLDER, fullBackupFile);
	const restoreCommand = `PGPASSWORD=${PGPASSWORD} psql ${DATABASE_URL} -f ${fullBackupPath}`;
	console.log(`Restoring full backup from ${fullBackupFile}...`);
	await executeCommand(restoreCommand);
	console.log(`Full backup restored from ${fullBackupFile}`);
};

const restoreIncrementalBackup = async (incrementalBackupFile: string) => {
	const incrementalBackupPath = path.join(BACKUP_FOLDER, incrementalBackupFile);
	const restoreCommand = `PGPASSWORD=${PGPASSWORD} psql ${DATABASE_URL} -f ${incrementalBackupPath}`;
	console.log(`Restoring incremental backup from ${incrementalBackupFile}...`);
	await executeCommand(restoreCommand);
	console.log(`Incremental backup restored from ${incrementalBackupFile}`);
};

const restoreDatabase = async () => {
	try {
		const files = fs.readdirSync(BACKUP_FOLDER);

		const fullBackupFiles = files.filter(
			(file) => file.startsWith('full_backup') && file.endsWith('.sql')
		);

		if (fullBackupFiles.length === 0) {
			console.log('No full backup found. Exiting...');
			return;
		}

		fullBackupFiles.sort();

		const fullBackupFile = fullBackupFiles[fullBackupFiles.length - 1];
		await restoreFullBackup(fullBackupFile);
		const fullBackupTimestamp = extractTimestamp(fullBackupFile);

		const incrementalBackupFiles = files
			.filter(
				(file) =>
					file.startsWith('incremental_backup') &&
					file.endsWith('.sql') &&
					extractTimestamp(file) > fullBackupTimestamp
			)
			.sort();

		if (incrementalBackupFiles.length > 0) {
			incrementalBackupFiles.sort();

			for (const incrementalBackupFile of incrementalBackupFiles) {
				await restoreIncrementalBackup(incrementalBackupFile);
			}
		}

		console.log('Database restore completed successfully!');
	} catch (error) {
		console.error('Error during restore:', error);
	}
};

function extractTimestamp(filename: string): string {
	const match = filename.match(/_(\d{4}_\d{2}_\d{2}_\d{2}_\d{2})/);
	return match ? match[1] : '';
}

restoreDatabase();
