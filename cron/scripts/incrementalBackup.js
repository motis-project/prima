import { exec } from 'child_process';
import { mkdirSync, existsSync, renameSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

config();

const BACKUP_DIR = '/app/db_backups'; // Define where backups will be saved
const WAL_ARCHIVE_DIR = '/path/to/archive'; // Define where WAL segments will be archived

// Make sure the backup directories exist
if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
}
if (!existsSync(WAL_ARCHIVE_DIR)) {
    mkdirSync(WAL_ARCHIVE_DIR, { recursive: true });
}

// This function will back up WAL files
function backupWAL() {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
    const backupFileName = `wal_backup_${timestamp}.tar.gz`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    console.log(`Starting WAL backup: ${backupFilePath}`);

    // Archive current WAL files
    const command = `tar -czf ${backupFilePath} -C ${WAL_ARCHIVE_DIR} .`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`WAL backup failed: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`Warning during WAL backup: ${stderr}`);
        }
        console.log(`WAL backup completed and saved at: ${backupFilePath}`);
    });
}

// Function to check for new WAL files and backup
function archiveWALFiles() {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '_');
    const archiveFileName = `wal_segment_${timestamp}.log`;
    const archiveFilePath = path.join(WAL_ARCHIVE_DIR, archiveFileName);

    // You might want to fetch new WAL files here using PostgreSQL commands
    const command = `cp /path/to/pg_wal/* ${archiveFilePath}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Failed to copy WAL segments: ${error.message}`);
            return;
        }
        if (stderr) {
            console.warn(`Warning during WAL copy: ${stderr}`);
        }
        console.log(`WAL segment copied and saved at: ${archiveFilePath}`);

        // After copying WAL files, back them up
        backupWAL();
    });
}

// Run the backup process
archiveWALFiles();
