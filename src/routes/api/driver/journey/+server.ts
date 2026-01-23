import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm.js';
import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export const GET = async ({ url }) => {
    const requestId = readInt(url.searchParams.get('requestId'));

    if (isNaN(requestId)) {
        error(400, { message: 'Invalid requestId parameter' });
    }

    const itinerary = await db
        .selectFrom('journey')
        .where('request1', '=', requestId)
        .select('journey.json')
        .executeTakeFirst();

    if (itinerary != undefined) {
        itinerary.json.legs.forEach(e => {
            e.steps = undefined
            e.legGeometry.points = ""
        })
        return json(itinerary.json);
    } else {
        return new Response(null, { status: 404 });
    }
};
