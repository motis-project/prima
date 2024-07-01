import { sql } from 'kysely';
export async function up(db) {
    await db.schema
        .createTable('person')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('first_name', 'varchar', (col) => col.notNull())
        .addColumn('last_name', 'varchar')
        .addColumn('gender', 'varchar(50)', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql `now()`).notNull())
        .execute();
    await db.schema
        .createTable('pet')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('name', 'varchar', (col) => col.notNull().unique())
        .addColumn('owner_id', 'integer', (col) => col.references('person.id').onDelete('cascade').notNull())
        .addColumn('species', 'varchar', (col) => col.notNull())
        .execute();
    await db.schema.createIndex('pet_owner_id_index').on('pet').column('owner_id').execute();
}
export async function down(db) {
    await db.schema.dropTable('pet').execute();
    await db.schema.dropTable('person').execute();
}
