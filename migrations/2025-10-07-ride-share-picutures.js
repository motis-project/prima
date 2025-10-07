export async function up(db) {
    await db.schema
        .alterTable('user')
        .addColumn('profile_picture', 'varchar')
        .execute();
    await db.schema
        .alterTable('ride_share_vehicle')
        .addColumn('picture', 'varchar')
        .execute();
}

export async function down() { }