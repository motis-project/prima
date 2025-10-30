export async function up(db) {
	await db.schema
		.createTable('ride_share_rating')
		.addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('rating', 'integer', (col) => col.notNull())
		.addColumn('request', 'integer', (col) => col.references('request.id').notNull())
		.addColumn('rated_is_customer', 'boolean', (col) => col.notNull())
		.execute();
}

export async function down() { }
