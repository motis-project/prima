export async function up(db) {
    await db.schema
        .alterTable('tour')
        .addColumn('fare_route', 'integer', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('tour')
        .dropColumn('fare_route')
        .execute();
}
