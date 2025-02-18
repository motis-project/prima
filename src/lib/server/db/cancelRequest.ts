import { sql } from "kysely";
import { db } from ".";

export const cancelRequest = async (requestId: number) => {
	await sql`CALL cancel_request(${requestId})`.execute(db);
};
