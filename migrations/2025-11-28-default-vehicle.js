export async function up(db) {
    await db.schema
        .alterTable('ride_share_vehicle')
        .alterColumn('license_plate', (col) => col.dropNotNull())
        .execute();

    const users = await db
        .selectFrom('user')
        .select(['id'])
        .execute();

    for (const user of users) {
        await db
            .insertInto('ride_share_vehicle')
            .values({
                passengers: 1,
                luggage: 0,
                smoking_allowed: false,
                owner: user.id
            })
            .execute();
    }
}

export async function down() { }
