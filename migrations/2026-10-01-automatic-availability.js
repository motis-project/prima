export async function up(db) {
    await db.schema
		.alterTable('vehicle')
		.addColumn('set_automatic_availability', 'boolean')
		.execute();
}

export async function down() { }