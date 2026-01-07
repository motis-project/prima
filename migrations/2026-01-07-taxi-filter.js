export async function up(db) {
    await db.schema
		.createTable('taxi_filter')
		.addColumn('setting_name', 'varchar', (col) => col.notNull())
		.addColumn('is_active', 'boolean', (col) => col.notNull())
		.addColumn('per_transfer', 'real', (col) => col.notNull())
		.addColumn('taxi_base', 'real', (col) => col.notNull())
		.addColumn('taxi_per_minute', 'real', (col) => col.notNull())
		.addColumn('taxi_direct_penalty', 'real', (col) => col.notNull())
		.addColumn('pt_slope', 'real', (col) => col.notNull())
		.addColumn('taxi_slope', 'real', (col) => col.notNull())
		.addUniqueConstraint('setting_name', ['setting_name'])
		.execute();
}

export async function down() { }