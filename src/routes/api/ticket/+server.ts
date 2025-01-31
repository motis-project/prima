import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';
import md5 from 'blueimp-md5';

export const POST = async (event) => {
    const companyId = event.locals.user?.company;
    if (!companyId) {
        error(400, {
            message: 'not allowed without write access to company'
        });
    }
    const url = event.url;
    const eventId = url.searchParams.get('eventId');
    const ticketHash = url.searchParams.get('ticketHash');

    if (eventId != null && ticketHash != null) {
        try {
            const ticketCode = await db
                .selectFrom('event')
                .where('id', '=', parseInt(eventId))
                .select('event.ticket_code')
                .executeTakeFirstOrThrow();

            if (md5(ticketCode) == ticketHash) {
                await db
                    .updateTable('event')
                    .set({ ticket_valid: 'true' })
                    .where('id', '=', parseInt(eventId))
                    .execute();
            }
        } catch (e) {
            /*error(500, {
                message: 'An unknown error occurred'
            });*/
        }
    }



    return json({});
}