export async function up(db) {
    await db.schema
        .alterTable('event')
        .addColumn('group', 'varchar', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('group')
        .execute();
}