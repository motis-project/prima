export async function up(db) {
    await db.schema
        .alterTable('availability')
        .addColumn('cap', 'integer', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('availability')
        .dropColumn('cap')
        .execute();
}