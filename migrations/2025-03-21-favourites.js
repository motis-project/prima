

export async function up(db) {
    await db.schema
        .createTable('favourites')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('user', 'integer', (col) => col.references('user.id').notNull())
        .addColumn('start', 'varchar', (col) => col.notNull())
        .addColumn('start_lat', 'real', (col) => col.notNull())
        .addColumn('start_lng', 'real', (col) => col.notNull())
        .addColumn('target', 'varchar', (col) => col.notNull())
        .addColumn('target_lat', 'real', (col) => col.notNull())
        .addColumn('target_lng', 'real', (col) => col.notNull())
        .execute();
}


export async function down(db) {
    await db.dropTable('favourites').execute();
}