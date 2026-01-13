export async function up(db) {
	await db.schema
		.createTable('desired_ride_share')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('from_lat', 'real', (col) => col.notNull())
		.addColumn('from_lng', 'real', (col) => col.notNull())
		.addColumn('to_lat', 'real', (col) => col.notNull())
		.addColumn('to_lng', 'real', (col) => col.notNull())
		.addColumn('from_address', 'varchar', (col) => col.notNull())
		.addColumn('to_address', 'varchar', (col) => col.notNull())
		.addColumn('start_fixed', 'boolean', (col) => col.notNull())
        .addColumn('luggage', 'integer', (col) => col.notNull())
        .addColumn('passengers', 'integer', (col) => col.notNull())
		.addColumn('time', 'bigint', (col) => col.notNull())
        .addColumn('interested_user', 'integer', (col) => col.references('user.id').notNull())
		.addColumn('url', 'varchar', (col) => col.notNull())
		.execute();
}

export async function down() {}
