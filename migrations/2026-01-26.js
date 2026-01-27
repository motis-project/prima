export async function up(db) {
	await db.schema
		.alterTable('ride_share_tour')
		.addColumn('approach_and_return_m', 'bigint')
		.addColumn('fully_payed_m', 'bigint')
		.addColumn('occupied_m', 'bigint')
		.execute();

	await db.schema
		.alterTable('tour')
		.addColumn('approach_and_return_m', 'bigint')
		.addColumn('fully_payed_m', 'bigint')
		.addColumn('occupied_m', 'bigint')
		.execute();
}

export async function down() { }