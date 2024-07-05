export async function up(db) {
    await db.schema
        .createTable('zone')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('area', 'varchar', (col) => col.notNull())
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('is_community', 'boolean', (col) => col.notNull())
        .execute();

    await db.schema
        .createTable('company')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('latitude', 'real', (col) => col.notNull())
        .addColumn('longitude', 'real', (col) => col.notNull())
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('address', 'varchar', (col) => col.notNull())
        .addColumn('zone', 'integer', (col) =>
            col.references('zone.id').onDelete('cascade').notNull(),
        )
        .addColumn('community_area', 'integer', (col) =>
            col.references('zone.id').onDelete('cascade').notNull(),
        )
        .execute();

    await db.schema
        .createTable('vehicle')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('license_plate', 'varchar', (col) => col.notNull())
        .addColumn('company', 'integer', (col) =>
            col.references('company.id').onDelete('cascade').notNull(),
        )
        .addColumn('seats', 'integer', (col) => col.notNull())
        .addColumn('wheelchair_capacity', 'integer', (col) => col.notNull())
        .addColumn('bike_capacity', 'integer', (col) => col.notNull())
        .addColumn('storage_space', 'integer', (col) => col.notNull())
        .execute();

    await db.schema
        .createTable('availability')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('start_time', 'timestamp', (col) => col.notNull())
        .addColumn('end_time', 'timestamp', (col) => col.notNull())
        .addColumn('vehicle', 'integer', (col) =>
            col.references('vehicle.id').onDelete('cascade').notNull(),
        )
        .execute();

    await db.schema
        .createTable('tour')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('departure', 'timestamp', (col) => col.notNull())
        .addColumn('arrival', 'timestamp', (col) => col.notNull())
        .addColumn('vehicle', 'integer', (col) =>
            col.references('vehicle.id').onDelete('cascade').notNull(),
        )
        .execute();

    await db.schema
        .createTable('auth_user')
        .addColumn('id', 'varchar', (col) => col.primaryKey())
        .addColumn('email', 'varchar', (col) => col.unique())
        .addColumn('password_hash', 'varchar')
        .execute();

    await db.schema
        .createTable('user_session')
        .addColumn('id', 'varchar', (col) => col.primaryKey())
        .addColumn('expires_at', 'timestamp', (col) => col.notNull())
        .addColumn('user_id', 'varchar', (col) =>
            col.references('auth_user.id').onDelete('cascade').notNull(),
        )
        .execute();
}

export async function down(db) {
    await db.schema.dropTable('zone').execute();
    await db.schema.dropTable('company').execute();
    await db.schema.dropTable('vehicle').execute();
    await db.schema.dropTable('availability').execute();
    await db.schema.dropTable('tour').execute();
    await db.schema.dropTable('auth_user').execute();
    await db.schema.dropTable('user_session').execute();
}
