export async function up(db) {
	for (const table of ['ride_share_tour', 'tour']) {
		await db.schema
			.alterTable(table)
			.addColumn('approach_and_return_driving_ms', 'bigint')
			.addColumn('approach_and_return_waiting_ms', 'bigint')
			.addColumn('fully_payed_driving_ms', 'bigint')
			.addColumn('fully_payed_waiting_ms', 'bigint')
			.addColumn('occupied_driving_ms', 'bigint')
			.addColumn('occupied_waiting_ms', 'bigint')
			.addColumn('cumulated_passenger_driving_ms', 'bigint')
			.addColumn('cumulated_passenger_waiting_ms', 'bigint')
			.addColumn('total_driving_ms', 'bigint')
			.addColumn('total_waiting_ms', 'bigint')
			.execute();
	}

	await db.schema.alterTable('request').addColumn('public_transport_duration_ms', 'bigint').execute();
}

export async function down(db) {
	await db.schema.alterTable('request').dropColumn('public_transport_duration_ms').execute();

	for (const table of ['ride_share_tour', 'tour']) {
		await db.schema
			.alterTable(table)
			.dropColumn('total_waiting_ms')
			.dropColumn('total_driving_ms')
			.dropColumn('cumulated_passenger_waiting_ms')
			.dropColumn('cumulated_passenger_driving_ms')
			.dropColumn('occupied_waiting_ms')
			.dropColumn('occupied_driving_ms')
			.dropColumn('fully_payed_waiting_ms')
			.dropColumn('fully_payed_driving_ms')
			.dropColumn('approach_and_return_waiting_ms')
			.dropColumn('approach_and_return_driving_ms')
			.execute();
	}
}
