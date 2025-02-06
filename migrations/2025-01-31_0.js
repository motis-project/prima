export async function up(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_valid')
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket_checked', 'boolean', (col) => col.defaultTo(false))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_checked')
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket_valid', 'varchar', (col) => col.defaultTo(null))
        .execute();
}