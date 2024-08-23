export async function up(db) {
    await db.schema
        .alterTable('tour')
        .addColumn('fare', 'integer', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('tour')
        .dropColumn('fare')
        .execute();
}
