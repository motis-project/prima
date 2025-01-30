import { sql } from 'kysely';

export async function up(db) {
	await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
	await sql`
		CREATE TABLE zone(
			id SERIAL PRIMARY KEY,
			area geography(MULTIPOLYGON,4326) NOT NULL,
			name varchar NOT NULL
		)`.execute(db);

	await db.schema
		.createTable('user')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('name', 'varchar', (col) => col.notNull())
		.addColumn('email', 'varchar', (col) => col.unique())
		.addColumn('password_hash', 'varchar', (col) => col.notNull())
		.addColumn('is_taxi_owner', 'boolean', (col) => col.notNull())
		.addColumn('is_admin', 'boolean', (col) => col.notNull())
		.addColumn('is_email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
		.addColumn('email_verification_code', 'varchar')
		.addColumn('email_verification_expires_at', 'timestamp')
		.addColumn('password_reset_code', 'varchar')
		.addColumn('password_reset_expires_at', 'timestamp')
		.addColumn('phone', 'varchar')
		.addColumn('company_id', 'integer')
		.execute();

	await db.schema
		.createTable('session')
		.addColumn('id', 'varchar', (col) => col.primaryKey())
		.addColumn('expires_at', 'timestamp', (col) => col.notNull())
		.addColumn('user_id', 'integer', (col) =>
			col.references('user.id').onDelete('cascade').notNull()
		)
		.execute();

	await db.schema
		.createTable('company')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('lat', 'real')
		.addColumn('lng', 'real')
		.addColumn('name', 'varchar')
		.addColumn('address', 'varchar')
		.addColumn('zone', 'integer', (col) => col.references('zone.id').onDelete('cascade'))
		.addColumn('community_area', 'integer', (col) => col.references('zone.id').onDelete('cascade'))
		.execute();

	await db.schema
		.createTable('vehicle')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('license_plate', 'varchar', (col) => col.notNull().unique())
		.addColumn('company', 'integer', (col) =>
			col.references('company.id').onDelete('cascade').notNull()
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
			col.references('vehicle.id').onDelete('cascade').notNull()
		)
		.execute();

	await db.schema
		.createTable('tour')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('departure', 'timestamp', (col) => col.notNull())
		.addColumn('arrival', 'timestamp', (col) => col.notNull())
		.addColumn('vehicle', 'integer', (col) =>
			col.references('vehicle.id').onDelete('cascade').notNull()
		)
		.addColumn('fare', 'integer')
		.execute();

	await db.schema
		.createTable('request')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('passengers', 'integer', (col) => col.notNull())
		.addColumn('wheelchairs', 'integer', (col) => col.notNull())
		.addColumn('bikes', 'integer', (col) => col.notNull())
		.addColumn('luggage', 'integer', (col) => col.notNull())
		.addColumn('tour', 'integer', (col) => col.references('tour.id').onDelete('cascade').notNull())
		.execute();

	await db.schema
		.createTable('event')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('is_pickup', 'boolean', (col) => col.notNull())
		.addColumn('lat', 'real', (col) => col.notNull())
		.addColumn('lng', 'real', (col) => col.notNull())
		.addColumn('scheduled_time', 'timestamp', (col) => col.notNull())
		.addColumn('communicated_time', 'timestamp', (col) => col.notNull())
		.addColumn('request', 'integer', (col) => col.references('request.id').onDelete('cascade'))
		.addColumn('address', 'varchar', (col) => col.notNull())
		.addColumn('tour', 'integer', (col) => col.references('tour.id').onDelete('cascade').notNull())
		.addColumn('customer', 'integer', (col) =>
			col.references('user.id').onDelete('cascade').notNull()
		)
		.execute();
}

export async function down(db) {
	await db.schema.dropTable('zone').execute();
	await db.schema.dropTable('company').execute();
	await db.schema.dropTable('vehicle').execute();
	await db.schema.dropTable('availability').execute();
	await db.schema.dropTable('tour').execute();
	await db.schema.dropTable('user').execute();
	await db.schema.dropTable('user_session').execute();
	await db.schema.dropTable('request').execute();
	await db.schema.dropTable('event').execute();
}
