export async function up(db) {
    await db.schema
        .alterTable('auth_user')
        .addColumn('is_driver', 'boolean', (col) =>
            col.notNull().defaultTo(false),
        )
        .execute();
}

export async function down(db) {
    await db.schema
    .alterTable('auth_user')
    .dropColumn('is_driver')
    .execute();
}