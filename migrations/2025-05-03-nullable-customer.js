export async function up(db) {
    await db.schema.alterTable('request')
        .alterColumn('customer', (col) => col.dropNotNull())
        .execute()
}

export async function down() { }
