export async function up(db) {
    await db.schema
        .createTable('availability_state')
        .addColumn('taken_at', 'bigint', (col) => col.notNull())
        .addColumn('company', 'integer', (col) => col.notNull())
		.addColumn('score', 'bigint', (col) => col.notNull())
        .execute();
}

export async function down() {}