import type { Database } from '$lib/server/db';
import { sql } from 'kysely';

export function lockTablesStatement(tables: Array<keyof Database>) {
	tables.sort();
	const tablesString = tables.map((t) => `"${t}"`).join(', ');
	return sql.raw(`LOCK TABLE ${tablesString} IN ACCESS EXCLUSIVE MODE;`);
}
