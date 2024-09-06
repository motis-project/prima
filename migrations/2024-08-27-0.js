export async function up(db) {
    await db.schema
        .alterTable('tour')
        .addColumn('fare_route', 'integer', (col) => col.defaultTo(null))
        .execute();

    await db.schema
        .alterTable('zone')
        .dropColumn('rates')
        .addColumn('rates', 'integer', (col) => col.defaultTo(null))
        .execute();

    await db.schema
        .dropTable('taxi_rates')
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('tour')
        .dropColumn('fare_route')
        .execute();

    await db.schema
        .createTable('taxi_rates')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('rates', 'varchar', (col) => col.notNull())
        .execute();

    await db.schema
        .alterTable('zone')
        .dropColumn('rates')
        .addColumn('rates', 'integer', (col) =>
            col.references('taxi_rates.id').onDelete('cascade'),
        )
        .execute();
}
