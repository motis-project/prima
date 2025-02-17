import { sql } from 'kysely';
import { db } from '.';

export async function cancelRequest(requestId: number) {
	await sql`CALL cancel_request(${requestId})`.execute(db);
}

export async function cancelTour(tourId: number, message: string | null) {
	await sql`CALL cancel_tour(${tourId}, ${message})`.execute(db);
}
