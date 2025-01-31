export async function up(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('ticket')
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket_code', 'varchar', (col) => col.defaultTo(null))
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket_hash', 'varchar', (col) => col.defaultTo(null))
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket_valid', 'varchar', (col) => col.defaultTo(null))
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_code')
        .execute();
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_hash')
        .execute();
    await db.schema
        .alterTable('event')
        .dropColumn('ticket_valid')
        .execute();
    await db.schema
        .alterTable('event')
        .addColumn('ticket', 'varchar', (col) => col.defaultTo(null))
        .execute();
}