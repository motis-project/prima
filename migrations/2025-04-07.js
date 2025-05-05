export async function up(db) {
    await db.schema.alterTable('journey')
        .alterColumn('request1', (col) => col.dropNotNull())
        .execute()
}

export async function down() { }
