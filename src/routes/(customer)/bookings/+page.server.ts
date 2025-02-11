import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import type { Itinerary } from '$lib/openapi';

export const load: PageServerLoad = async ({ params, locals }) => {
    const journeys = await db
        .selectFrom('journey')
        .select(['json', 'id'])
        .where('user', '=', locals.session!.userId!)
        .execute();
    return {
        journeys: journeys.map((journey) => {
            return {
                journey: JSON.parse(journey.json) as Itinerary,
                id: journey.id
            };
        })
    };
}