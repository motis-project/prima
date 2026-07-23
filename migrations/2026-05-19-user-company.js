export async function up(db) {
	await db.schema
		.alterTable('user')
		.addColumn('company', 'varchar', (col) => col.notNull().defaultTo(''))
		.execute();
}

export async function down() { }