export async function up(db) {
    await db.schema
        .alterTable('event')
        .addColumn('passengers', 'integer', (col) => col.notNull())
        .addColumn('wheelchairs', 'integer', (col) => col.notNull())
        .addColumn('bikes', 'integer', (col) => col.notNull())
        .addColumn('luggage', 'integer', (col) => col.notNull())
        .execute();
}

export async function down(db) {
    await db.schema
        .alterTable('event')
        .dropColumn('passengers')
        .dropColumn('wheelchairs')
        .dropColumn('bikes')
        .dropColumn('luggage')
        .execute();
}
