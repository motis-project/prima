import type { SimulationStats } from '$lib/server/simulation/simulation';
import type { PageServerLoad } from './$types';
import { readFile } from 'fs/promises';
import path from 'path';

export const load: PageServerLoad = async () => {
	const filePath = path.resolve('simulation-stats.jsonl');

	let data: SimulationStats[] = [];

	try {
		const raw = await readFile(filePath, 'utf-8');

		data = raw
			.split('\n')
			.filter((line) => line.trim().length > 0)
			.map((line) => {
				try {
					return JSON.parse(line) as SimulationStats;
				} catch {
					return null;
				}
			})
			.filter((entry): entry is SimulationStats => entry !== null);
	} catch (err) {
		console.error('Failed to read time stat:', err);
	}

	return { data };
};
