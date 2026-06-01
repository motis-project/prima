export async function up(db) {
    await db.schema
        .dropTable('availability_compensation')
        .execute();
}

export async function down() {}