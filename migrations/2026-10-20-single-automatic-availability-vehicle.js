export async function up(db) {
	await db.schema
		.createIndex('vehicle_one_automatic_availability_per_company_idx')
		.unique()
		.on('vehicle')
		.column('company')
		.where('set_automatic_availability', '=', true)
		.execute();
}

export async function down(db) {
	await db.schema.dropIndex('vehicle_one_automatic_availability_per_company_idx').execute();
}
