export async function up(db) {
	await db.schema
		.alterTable('ride_share_vehicle')
		.addUniqueConstraint('ride_share_vehicle_license_plate', ['license_plate', 'owner'])
		.execute();
}

export async function down() { }