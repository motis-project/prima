import { db } from '$lib/database';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { intersects } from '$lib/sqlHelpers';

describe('intersects test', () => {
	it('2 methods for checking zone overlaps yield same results', async () => {
		const firstCommunityId = 7;
		const lastCommunityId = 86;
		for (let compulsory = 1; compulsory != firstCommunityId; ++compulsory) {
			for (let community = firstCommunityId; community != lastCommunityId + 1; ++community) {
				const area = await db
					.selectFrom('zone as compulsory')
					.where('compulsory.id', '=', compulsory)
					.innerJoin(
						(eb) => eb.selectFrom('zone').where('id', '=', community).selectAll().as('community'),
						(join) => join.onTrue()
					)
					.select([
						sql<string>`ST_AsGeoJSON(ST_Intersection(compulsory.area, community.area))`.as('area')
					])
					.executeTakeFirst();
				const method1Result = area!.area.includes('Polygon') && !area!.area.includes('[]');
				const method2Result = await intersects(compulsory, community);
				expect(method1Result).toBe(method2Result);
			}
		}
	});
});
