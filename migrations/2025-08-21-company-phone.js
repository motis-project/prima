export async function up(db) {
    await db.schema.alterTable('company')
        .addColumn('phone', 'varchar')
        .execute()
}

export async function down() { }