

export async function up(db) {
    await db.schema
        .createTable('favourite_locations')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user', 'integer', (col) => col.references('user.id').notNull())
        .addColumn('address', 'varchar', (col) => col.notNull())
        .addColumn('lat', 'real', (col) => col.notNull())
        .addColumn('lng', 'real', (col) => col.notNull())
        .addColumn('count', 'integer', (col) => col.notNull().defaultTo(0))
        .execute();

    await db.schema
        .createTable('favourite_routes')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user', 'integer', (col) => col.references('user.id').notNull())
		.addColumn('from_id', 'integer', (col) => col.references('favourite_locations.id').notNull())
		.addColumn('to_id', 'integer', (col) => col.references('favourite_locations.id').notNull())
        .addColumn('count', 'integer', (col) => col.notNull().defaultTo(0))
        .execute();
}


export async function down(db) {
    await db.dropTable('favourite_routes').execute();
    await db.dropTable('favourite_locations').execute();
}
