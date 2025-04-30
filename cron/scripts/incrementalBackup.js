import { exec } from 'child_process';
import path from 'path';
import { config } from 'dotenv';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';

config();

// Directory where WAL archive backups are stored
const WAL_ARCHIVE_DIR = '/app/db_backups/wal_archives'; // Change as per your setup

// Ensure the WAL archive directory exists
if (!existsSync(WAL_ARCHIVE_DIR)) {
  mkdirSync(WAL_ARCHIVE_DIR, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL_INTERNAL;
const dbUser = process.env.POSTGRES_USER;
const dbPassword = process.env.POSTGRES_PASSWORD;
const targetDatabase = process.env.POSTGRES_DB || 'prima';

const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
const FILE_NAME = `incremental_backup_${timestamp}.tar.gz`;
const BACKUP_FILE_PATH = path.join(WAL_ARCHIVE_DIR, FILE_NAME);

function performIncrementalBackup() {
  const command = `PGPASSWORD=${dbPassword} pg_basebackup -h ${dbUrl} -U ${dbUser} -D ${BACKUP_FILE_PATH} -Ft -z`;

  console.log(`Starting incremental backup: ${FILE_NAME}`);

  exec(command, (error, _, stderr) => {
    if (error) {
      console.error(`Error during backup: ${error.message}`);
      return;
    }
    if (stderr) {
      console.warn(`Backup stderr: ${stderr}`);
    }

    console.log(`Incremental backup saved at: ${BACKUP_FILE_PATH}`);
  });
}

performIncrementalBackup();
