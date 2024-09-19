import { db } from '$lib/database';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { intersects } from '$lib/sqlHelpers';

type ZonePair = {
	compulsory: number;
	community: number;
};

describe('intersects test', () => {
	const useOldMethod = (zones: ZonePair[]) => {
		return zones.map(
			async (z) =>
				(await db
					.selectFrom('zone as compulsory_area')
					.where('compulsory_area.id', '=', z.compulsory)
					.innerJoin(
						(eb) => eb.selectFrom('zone').where('id', '=', z.community).selectAll().as('community'),
						(join) => join.onTrue()
					)
					.where(sql<boolean>`ST_Intersects(compulsory_area.area, community.area)`)
					.selectAll()
					.executeTakeFirst()) != undefined
		);
	};

	const useNewMethod = (zones: ZonePair[]) => {
		return zones.map(async (z) => await intersects(z.compulsory, z.community));
	};

	const noOverlaps = [
		{ compulsory: 1, community: 34 },
		{ compulsory: 1, community: 36 },
		{ compulsory: 1, community: 37 },
		{ compulsory: 1, community: 39 },
		{ compulsory: 1, community: 40 },
		{ compulsory: 1, community: 41 }
	];
	const oneDimensionalOverlaps = [
		{ compulsory: 1, community: 35 },
		{ compulsory: 1, community: 38 },
		{ compulsory: 1, community: 49 },
		{ compulsory: 1, community: 57 },
		{ compulsory: 1, community: 59 },
		{ compulsory: 1, community: 68 }
	];
	const twoDimensionalOverlaps = [
		{ compulsory: 1, community: 7 },
		{ compulsory: 1, community: 8 },
		{ compulsory: 1, community: 9 },
		{ compulsory: 1, community: 10 },
		{ compulsory: 1, community: 11 },
		{ compulsory: 1, community: 12 }
	];

	it('compare old and new Intersects method on zones and companies with no overlap', async () => {
		const old = useOldMethod(noOverlaps);
		for (let i = 0; i != old.length; ++i) {
			expect(await old[i]).toBe(false);
		}
		const newIntersects = useNewMethod(noOverlaps);
		for (let i = 0; i != newIntersects.length; ++i) {
			expect(await newIntersects[i]).toBe(false);
		}
	});
	it('compare old and new Intersects method on zones and companies with 1-dim overlap', async () => {
		const old = useOldMethod(oneDimensionalOverlaps);
		for (let i = 0; i != old.length; ++i) {
			expect(await old[i]).toBe(true);
		}
		const newIntersects = useNewMethod(oneDimensionalOverlaps);
		for (let i = 0; i != newIntersects.length; ++i) {
			expect(await newIntersects[i]).toBe(false);
		}
	});
	it('compare old and new Intersects method on zones and companies with 2-dim overlap', async () => {
		const old = useOldMethod(twoDimensionalOverlaps);
		for (let i = 0; i != old.length; ++i) {
			expect(await old[i]).toBe(true);
		}
		const newIntersects = useNewMethod(twoDimensionalOverlaps);
		for (let i = 0; i != newIntersects.length; ++i) {
			expect(await newIntersects[i]).toBe(true);
		}
	});
});
