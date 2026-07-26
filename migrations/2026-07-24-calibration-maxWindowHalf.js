export async function up(db) {
    await db.schema
		.alterTable('taxi_filter')
		.addColumn('damping_window', 'real', (col) => col.notNull().defaultTo(0))
		.execute();
}

export async function down() { }