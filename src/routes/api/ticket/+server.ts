import { db } from '$lib/database';
import { json } from '@sveltejs/kit';
import md5 from 'blueimp-md5';

export const POST = async (event) => {
    /*const companyId = event.locals.user?.company;
    if (!companyId) {
        error(400, {
            message: 'not allowed without write access to company'
        });
    }*/
    const url = event.url;
    const eventId = url.searchParams.get('eventId');
    const ticketHash = url.searchParams.get('ticketHash');
    var status = 500;

    if (eventId != null && ticketHash != null) {
        try {
            const ticketCode = await db
                .selectFrom('event')
                .where('id', '=', parseInt(eventId))
                .select('event.ticket_code')
                .executeTakeFirstOrThrow();

            if (md5(ticketCode['ticket_code']) == ticketHash) {
                await db
                    .updateTable('event')
                    .set({ ticket_valid: 'true' })
                    .where('id', '=', parseInt(eventId))
                    .execute();
                status = 200;
            }
        } catch (e) {
            status = 500;
        }
    }

    return json({ "status": status });
}