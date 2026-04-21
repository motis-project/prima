import { beforeAll, describe, it } from 'vitest';
import { simulation, type SimulationParams } from './simulation';
import { MINUTE } from '$lib/util/time';
import { clearDatabase } from '$lib/testHelpers';

beforeAll(async () => {
	await clearDatabase();
});

const duration = 9 * MINUTE;

describe(
	'simulation as test',
	() => {
		it('simulation', async () => {
			const p: SimulationParams = {
				restrict: true,
				finishTime: Date.now() + duration,
				mode: 'taxi',
				healthChecks: true,
				full: true,
				companies: 3,
				vehiclesPerCompany: 3
			};
			await simulation(p);
		});
	},
	MINUTE + duration
);
