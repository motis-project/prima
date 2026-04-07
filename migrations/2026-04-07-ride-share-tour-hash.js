export async function up(db) {
	await db.schema
		.alterTable('ride_share_tour')
		.addColumn('hash', 'varchar')
		.execute();
}

export async function down() { }