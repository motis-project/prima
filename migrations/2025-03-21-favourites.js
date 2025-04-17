

export async function up(db) {
    await db.schema
        .createTable('favourite_locations')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user', 'integer', (col) => col.references('user.id').notNull())
        .addColumn('address', 'varchar', (col) => col.notNull())
        .addColumn('lat', 'real', (col) => col.notNull())
        .addColumn('lng', 'real', (col) => col.notNull())
        .addColumn('level', 'integer', (col) => col.notNull())
        .addColumn('last_timestamp', 'bigint', (col) => col.notNull())
        .addColumn('count', 'integer', (col) => col.notNull().defaultTo(1))
        .execute();

    await db.schema
        .createTable('favourite_routes')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user', 'integer', (col) => col.references('user.id').notNull())
        .addColumn('from_id', 'integer', (col) => col.references('favourite_locations.id').notNull())
        .addColumn('to_id', 'integer', (col) => col.references('favourite_locations.id').notNull())
        .addColumn('last_timestamp', 'bigint', (col) => col.notNull())
        .addColumn('count', 'integer', (col) => col.notNull().defaultTo(1))
        .execute();
}

export async function down(db) {
    await db.dropTable('favourite_routes').execute();
    await db.dropTable('favourite_locations').execute();
}
