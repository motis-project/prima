export async function up(db) {
	await db.schema.dropIndex('vehicle_one_automatic_availability_per_company_idx').execute();
}

export async function down() { }
