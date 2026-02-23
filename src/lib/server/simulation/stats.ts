import { appendFile, writeFile } from 'fs/promises';
import type { SimulationStats } from './simulation';

export function createJsonlTimeStatWriter(file: string, flushInterval = 100) {
	let buffer: SimulationStats[] = [];

	async function init() {
		await writeFile(file, '');
	}

	async function record(stat: SimulationStats) {
		buffer.push(stat);

		if (buffer.length >= flushInterval) {
			await flush();
		}
	}

	async function flush() {
		if (buffer.length === 0) return;

		const lines = buffer.map((s) => JSON.stringify(s)).join('\n') + '\n';

		await appendFile(file, lines);
		buffer = [];
	}

	async function close() {
		await flush();
	}

	return {
		init,
		record,
		flush,
		close
	};
}
