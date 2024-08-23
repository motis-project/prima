export async function up(db) {
    await db.schema
        .createTable('taxi_rates')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('rates', 'varchar', (col) => col.notNull())
        .execute();
    await db.schema
        .alterTable('zone')
        .addColumn('rates', 'integer', (col) =>
            col.references('taxi_rates.id').onDelete('cascade'),
        )
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('zone')
        .dropColumn('rates')
        .execute();
    await db.schema.dropTable('taxi_rates').execute();
}
