#!/usr/bin/env ts-node

import { logHelp } from './logHelp';
import { simulation } from '../../src/lib/server/simulation/simulation';

async function main() {
	function checkIntArg(arg: string, flag: string) {
		if (!arg.startsWith(`--${flag}`)) {
			return -1;
		}
		const value = parseInt(arg.split('=')[1], 10);
		if (isNaN(value) || value <= 0) {
			console.error(`Invalid value for --${flag}. Must be a positive integer.`);
			process.exit(1);
		}
		return value;
	}
	let healthChecks = false;
	let runs: number | undefined = undefined;
	let finishTime: number | undefined = undefined;
	let ongoing = false;
	let help = false;
	let restrict = false;
	let backups = false;
	let whitelist = false;
	let cost = false;
	let mode: undefined | string = undefined;
	let full = false;
	let companies = 3;
	let vehicles = 2;
	for (const arg of process.argv) {
		if (arg === '--health') {
			healthChecks = true;
		}
		if (arg === '--wl') {
			whitelist = true;
		}
		if (arg === '--full') {
			full = true;
		}
		if (arg === '--cost') {
			cost = true;
		}
		if (arg === '--bu') {
			backups = true;
		}
		if (arg === '--restrict') {
			restrict = true;
		}
		if (arg.startsWith('--mode')) {
			const value = arg.split('=')[1];
			const modes = ['rs', 'taxi', 'pt', 'taxionly'];
			if (!modes.some((m) => m === value)) {
				console.error('Invalid value for --mode. Must be any of: rs taxi pt taxionly.');
				process.exit(1);
			}
			mode = value;
		}
		if (arg.startsWith('--companies')) {
			companies = checkIntArg(arg, 'companies');
		}
		if (arg.startsWith('--vehicles')) {
			vehicles = checkIntArg(arg, 'vehicles');
		}
		if (arg.startsWith('--runs=')) {
			runs = checkIntArg(arg, 'runs');
		} else if (arg.startsWith('--seconds=')) {
			const value = checkIntArg(arg, 'seconds');
			finishTime = Date.now() + 1000 * value;
		} else if (arg === '--ongoing') {
			ongoing = true;
		} else if (arg === '--help') {
			help = true;
		}
	}

	if (help) {
		logHelp();
		process.exit(0);
	}
	simulation({
		backups,
		healthChecks,
		restrict,
		ongoing,
		runs,
		finishTime,
		whitelist,
		cost,
		mode,
		full,
		companies,
		vehiclesPerCompany: vehicles
	});
}
main().catch((err) => {
	console.error(err);
	process.exit(1);
});
