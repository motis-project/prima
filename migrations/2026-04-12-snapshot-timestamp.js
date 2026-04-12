export async function up(db) {
    await db.schema
        .alterTable('availability_state')
        .addColumn('taken_at', 'bigint', (col) => col.notNull().defaultTo(0))
        .execute();
}

export async function down() {}