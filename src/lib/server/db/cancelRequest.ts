import { sql } from 'kysely';
import { db } from '.';

export const cancelRequest = async (requestId: number, userId: number) => {
	await sql`CALL cancel_request(${requestId}, ${userId}, ${Date.now()})`.execute(db);
};
