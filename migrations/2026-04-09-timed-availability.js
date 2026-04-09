export async function up(db) {
    await db.schema
        .alterTable('availability')
        .addColumn('created_at', 'bigint', (col) => col.notNull().defaultTo(1777593600000))
        .execute();
}

export async function down() {}