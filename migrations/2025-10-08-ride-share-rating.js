export async function up(db) {
	await db.schema
		.createTable('ride_share_rating')
		.addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('rating', 'integer', (col) => col.notNull())
		.addColumn('rated_user', 'integer', (col) => col.references('user.id').notNull())
		.addColumn('rating_user', 'integer', (col) => col.references('user.id').notNull())
		.execute();
}

export async function down() { }
