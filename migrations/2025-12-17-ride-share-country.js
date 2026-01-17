export async function up(db) {
	await db.schema
		.alterTable('ride_share_vehicle')
		.addColumn('country', 'varchar', (col) => col.notNull().defaultTo('DE'))
		.execute();
}

export async function down() { }