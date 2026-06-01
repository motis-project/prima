export async function up(db) {
    await db.schema
        .createTable('availability_state')
        .addColumn('start_of_month', 'bigint', (col) => col.notNull())
        .addColumn('company', 'integer', (col) => col.notNull())
		.addColumn('score', 'double precision', (col) => col.notNull())
		.addColumn('prefactor', 'double precision', (col) => col.notNull())
        .execute();
    await db.schema
        .createTable('availability_compensation')
        .addColumn('start_of_month', 'bigint', (col) => col.notNull())
        .addColumn('company', 'integer', (col) => col.notNull())
		.addColumn('score', 'double precision', (col) => col.notNull())
        .execute();
}

export async function down() {}