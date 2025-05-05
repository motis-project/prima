import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = new URL('.', import.meta.url).pathname;

const BACKUP_FOLDER = path.join(__dirname, '..', 'db_backups');

const DATABASE_URL = process.env.DATABASE_URL;
const PGPASSWORD = process.env.PGPASSWORD;

const executeCommand = (command) => {
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

const restoreFullBackup = async (fullBackupFile) => {
	const fullBackupPath = path.join(BACKUP_FOLDER, fullBackupFile);
	const restoreCommand = `PGPASSWORD=${PGPASSWORD} psql ${DATABASE_URL} -f ${fullBackupPath}`;
	console.log(`Restoring full backup from ${fullBackupFile}...`);
	await executeCommand(restoreCommand);
	console.log(`Full backup restored from ${fullBackupFile}`);
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
		console.log('Database restore completed successfully!');
	} catch (error) {
		console.error('Error during restore:', error);
	}
};

restoreDatabase();
