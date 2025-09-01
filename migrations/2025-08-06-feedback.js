
export async function up(db) {      
    db.schema
        .alterTable("journey")
        .addColumn("rating_booking", "integer")
        .addColumn("reason", "varchar")
        .execute();
}

export async function down() { }
