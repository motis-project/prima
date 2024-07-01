import { sql } from 'kysely';
export async function up(db) {
    await db.schema
        .createTable('zone')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .execute();

    await db.schema
        .createTable('company')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('latitude', 'real', (col) => col.notNull())
        .addColumn('longitude', 'real', (col) => col.notNull())
        .addColumn('display_name', 'varchar', (col) => col.notNull())
        .addColumn('email', 'varchar', (col) => col.notNull().unique())
        .addColumn('zone', 'integer', (col) =>
            col.references('zone.id').onDelete('cascade').notNull(),
        )
        .execute();
}
export async function down(db) {
    await db.schema.dropTable('zone').execute();
    await db.schema.dropTable('company').execute();
}
