export async function up(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_hash')
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('event')
        .addColumn('ticket_hash', 'varchar', (col) => col.defaultTo(null))
        .execute();
}