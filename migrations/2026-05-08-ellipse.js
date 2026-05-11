export async function up(db) {
    await db.schema
		.createTable('ellipse')
		.addColumn('id', 'serial', (col) => col.primaryKey())
		.addColumn('origin_lat_rad', 'double precision', (col) => col.notNull())
		.addColumn('origin_lng_rad', 'double precision', (col) => col.notNull())
		.addColumn('min_x', 'double precision', (col) => col.notNull())
		.addColumn('max_x', 'double precision', (col) => col.notNull())
		.addColumn('min_y', 'double precision', (col) => col.notNull())
		.addColumn('max_y', 'double precision', (col) => col.notNull())
		.addColumn('center_x', 'double precision', (col) => col.notNull())
		.addColumn('center_y', 'double precision', (col) => col.notNull())
		.addColumn('axis_xx', 'double precision', (col) => col.notNull())
		.addColumn('axis_xy', 'double precision', (col) => col.notNull())
		.addColumn('axis_yx', 'double precision', (col) => col.notNull())
		.addColumn('axis_yy', 'double precision', (col) => col.notNull())
		.addColumn('inv_aa_sq', 'double precision', (col) => col.notNull())
		.addColumn('inv_bb_sq', 'double precision', (col) => col.notNull())
		.addColumn('cos_origin_lat', 'double precision', (col) => col.notNull())
		.addColumn('point_only', 'boolean', (col) => col.notNull())
        .execute();

    await db.schema
        .alterTable('ride_share_tour')
        .addColumn('ellipse_id', 'integer', (col) => col.references('ellipse.id'))
        .execute();
}

export async function down() { }