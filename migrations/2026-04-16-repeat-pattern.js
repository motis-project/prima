export async function up(db) {
	await db.schema
        .createTable('repeat_pattern')
		.addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('days', 'integer', (col) => col.notNull())
        .addColumn('range_start', 'varchar', (col) => col.notNull())
		.addColumn('range_end', 'varchar', (col) => col.notNull())
        .execute();

	await db.schema
		.alterTable('ride_share_tour')
		.addColumn('pattern', 'integer', (col) => col.references('repeat_pattern.id'))
		.execute();
}

export async function down() { }
