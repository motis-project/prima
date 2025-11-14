import { describe, expect, it } from 'vitest';
import { oneToManyCarRouting } from './server/util/oneToManyCarRouting';
import { carRouting } from './util/carRouting';

const inNiesky1 = { lat: 51.29468377345111, lng: 14.833542206420248 };
const inNiesky2 = { lat: 51.29544187321241, lng: 14.820560314788537 };
const onHighway1 = { lat: 51.4089317342613, lng: 14.555534473428708 };
const onHighway2 = { lat: 51.41216953958255, lng: 14.582088345268431 };

describe('tests for cancelling tours', () => {
	it('validate oneToMany and oneToOne return the same', async () => {
		{
			const oneToManyDuration = await oneToManyCarRouting(inNiesky1, [inNiesky2], false);
			const oneToOneDuration = await carRouting(inNiesky1, inNiesky2);
			expect(oneToManyDuration[0]).toBe(oneToOneDuration?.duration);
		}
		{
			const oneToManyDuration = await oneToManyCarRouting(inNiesky1, [inNiesky2], true);
			const oneToOneDuration = await carRouting(inNiesky2, inNiesky1);
			expect(oneToManyDuration[0]).toBe(oneToOneDuration?.duration);
		}
		{
			const oneToManyDuration = await oneToManyCarRouting(onHighway1, [onHighway2], false);
			const oneToOneDuration = await carRouting(onHighway1, onHighway2);
			expect(oneToManyDuration[0]).toBe(oneToOneDuration?.duration);
		}
		{
			const oneToManyDuration = await oneToManyCarRouting(onHighway1, [onHighway2], true);
			const oneToOneDuration = await carRouting(onHighway2, onHighway1);
			expect(oneToManyDuration[0]).toBe(oneToOneDuration?.duration);
		}
	});
});
