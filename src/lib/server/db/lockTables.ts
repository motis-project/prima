import type { Database } from '$lib/server/db';
import { sql } from 'kysely';

export function lockTablesStatement(tables: Array<keyof Database>) {
	const sortedTables = [...tables].sort();
	return sql`LOCK TABLE ${sql.join(
		sortedTables.map((table) => sql`"${table}"`),
		sql`, `
	)} IN ACCESS EXCLUSIVE MODE;`;
}
