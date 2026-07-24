export async function up(db) {
    await db.schema
		.alterTable('taxi_filter')
		.addColumn('damping_window', 'real', (col) => col.notNull())
		.execute();
}

export async function down() { }