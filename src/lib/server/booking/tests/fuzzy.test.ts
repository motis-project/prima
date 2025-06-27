import { clearTours } from '$lib/testHelpers';
import { describe, it, expect, beforeAll } from 'vitest';
import { simulation } from '../../../../../scripts/simulation/script';
import { SECOND } from '$lib/util/time';

beforeAll(async () => {
	await clearTours();
}, 60000);

describe('Fuzzy booking tests', () => {
	it('', async () => {
		const params = {
			healthChecks: false,
			ongoing: false,
			runs: undefined,
			backups: false,
			restrict: true,
			finishTime: Date.now() + 30 * SECOND
		};
		await simulation(params);
		params.healthChecks = true;
		params.finishTime = Date.now() + 10 * SECOND;
		expect(await simulation(params)).toBe(false);
	});
}, 120000);
