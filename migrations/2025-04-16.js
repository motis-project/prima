export async function up(db) {
    await db.schema
        .alterTable('journey')
        .alterColumn('json', (col) => col.dropNotNull())
        .execute();
}
