export async function up(db) {
    await db.schema
		.createTable('fcm_token')
		.addColumn('device_id', 'varchar', (col) => col.notNull())
		.addColumn('company', 'integer', (col) => col.notNull())
		.addColumn('fcm_token', 'varchar', (col) => col.notNull())
		.addUniqueConstraint('device_company', ['device_id', 'company'])
		.execute();
}