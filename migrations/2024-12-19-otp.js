export async function up(db) {
    await db.schema
        .alterTable('auth_user')
        .addColumn('otp', 'varchar', (col) => col.defaultTo(null))
        .execute();
}