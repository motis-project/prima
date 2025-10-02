export async function up(db) {
	await db.schema
		.alterTable('user')
		.addColumn('profile_picture', 'varchar')
		.execute();
}

export async function down() { }