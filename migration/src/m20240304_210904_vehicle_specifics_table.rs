use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(
        &self,
        manager: &SchemaManager,
    ) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(VehicleSpecifics::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(VehicleSpecifics::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(VehicleSpecifics::Seats).integer().not_null())
                    .col(
                        ColumnDef::new(VehicleSpecifics::Wheelchairs)
                            .integer()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(VehicleSpecifics::StorageSpace)
                            .integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .drop_column(Vehicle::Seats)
                    .drop_column(Vehicle::Wheelchairs)
                    .drop_column(Vehicle::StorageSpace)
                    .add_column(ColumnDef::new(Vehicle::Specifics).integer().not_null())
                    .to_owned(),
            )
            .await?;

        let foreign_key_specifics = TableForeignKey::new()
            .name("fk-vehicle-specifics")
            .from_tbl(Vehicle::Table)
            .from_col(Vehicle::Specifics)
            .to_tbl(VehicleSpecifics::Table)
            .to_col(VehicleSpecifics::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .add_foreign_key(&foreign_key_specifics)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Capacity::Table)
                    .add_column(
                        ColumnDef::new(Capacity::VehicleSpecifics)
                            .integer()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        let foreign_key_vehicle_specifics = TableForeignKey::new()
            .name("fk-capacity-vehicle_specifics")
            .from_tbl(Capacity::Table)
            .from_col(Capacity::VehicleSpecifics)
            .to_tbl(VehicleSpecifics::Table)
            .to_col(VehicleSpecifics::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Capacity::Table)
                    .add_foreign_key(&foreign_key_vehicle_specifics)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(
        &self,
        manager: &SchemaManager,
    ) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(VehicleSpecifics::Table).to_owned())
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .add_column(ColumnDef::new(Vehicle::Seats).integer().not_null())
                    .add_column(ColumnDef::new(Vehicle::Wheelchairs).integer().not_null())
                    .add_column(ColumnDef::new(Vehicle::StorageSpace).integer().not_null())
                    .drop_column(Vehicle::Specifics)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Capacity::Table)
                    .drop_column(Capacity::VehicleSpecifics)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum VehicleSpecifics {
    Table,
    Id,
    Seats,
    Wheelchairs,
    StorageSpace,
}

#[derive(DeriveIden)]
enum Vehicle {
    Table,
    Seats,
    Wheelchairs,
    StorageSpace,
    Specifics,
}

#[derive(DeriveIden)]
enum Capacity {
    Table,
    VehicleSpecifics,
}
