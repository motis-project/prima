#!/usr/bin/env node

import fs from 'fs';
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';

const CRONTAB_PATH = '/etc/cron.d/cron-jobs';
const ENVIRONMENT_PATH = '/etc/environment';
const CHECK_INTERVAL = 10 * 60 * 1000;

function exportEnvironmentVariables() {
	try {
		const envVars = Object.entries(process.env)
			.filter(([key]) => key !== 'no_proxy')
			.map(([key, value]) => `${key}=${value}`)
			.join('\n');

		fs.writeFileSync(ENVIRONMENT_PATH, envVars);
	} catch (error) {
		console.error('Error exporting environment variables:', error.message);
		process.exit(1);
	}
}

function getFileMd5(filePath) {
	if (!fs.existsSync(filePath)) {
		return '';
	}

	try {
		const fileContent = fs.readFileSync(filePath);
		return crypto.createHash('md5').update(fileContent).digest('hex');
	} catch (error) {
		console.error(`Error calculating MD5 for ${filePath}:`, error.message);
		return '';
	}
}

function loadCrontab() {
	if (!fs.existsSync(CRONTAB_PATH) || !fs.statSync(CRONTAB_PATH).size) {
		console.warn(`Warning: Crontab file is empty or doesn't exist at ${new Date().toISOString()}`);
		return false;
	}

	try {
		fs.chmodSync(CRONTAB_PATH, 0o644);

		execSync(`crontab ${CRONTAB_PATH}`);

		console.log(`Crontab loaded successfully at ${new Date().toISOString()}`);
		return true;
	} catch (error) {
		console.error('Error loading crontab:', error.message);
		return false;
	}
}

function watchCrontab() {
	let previousMd5 = getFileMd5(CRONTAB_PATH);
	console.log(`Starting crontab watcher (checking every 10 minutes)`);

	setInterval(() => {
		const currentMd5 = getFileMd5(CRONTAB_PATH);

		if (currentMd5 && currentMd5 !== previousMd5) {
			console.log(`Crontab file changed, reloading at ${new Date().toISOString()}`);
			loadCrontab();
			previousMd5 = currentMd5;
		}
	}, CHECK_INTERVAL);
}

function startCron() {
	try {
		execSync('service cron start');
	} catch (error) {
		console.error('Error starting cron daemon:', error.message);
		process.exit(1);
	}
}

function executeCommand() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log('No command specified, running tail -f /var/log/cron.log as default');
		const tailProcess = spawn('tail', ['-f', '/var/log/cron.log'], { stdio: 'inherit' });

		tailProcess.on('close', (code) => {
			console.log(`tail process exited with code ${code}`);
			process.exit(code);
		});
	} else {
		const childProcess = spawn(args[0], args.slice(1), { stdio: 'inherit' });

		childProcess.on('close', (code) => {
			console.log(`Command exited with code ${code}`);
			process.exit(code);
		});
	}
}

(function main() {
	exportEnvironmentVariables();
	loadCrontab();
	watchCrontab();
	startCron();
	executeCommand();
})();
