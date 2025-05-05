
export async function up(db) {
    await db.schema
      .alterTable('request')
      .addColumn('license_plate_updated_at', 'bigint')
      .execute();
}

export async function down(db) {
    await db.alterTable('request').dropColumn('license_plate_updated_at').execute();
}
