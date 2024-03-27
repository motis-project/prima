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
                    .table(Assignment::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Assignment::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Assignment::Departure).date_time().not_null())
                    .col(ColumnDef::new(Assignment::Arrival).date_time().not_null())
                    .col(ColumnDef::new(Assignment::Company).integer().not_null())
                    .col(ColumnDef::new(Assignment::Vehicle).integer())
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .add_column(ColumnDef::new(Vehicle::Active).boolean().not_null())
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .modify_column(ColumnDef::new(Event::ChainId).not_null())
                    .add_column(
                        ColumnDef::new(Event::RequiredVehicleSpecifics)
                            .integer()
                            .not_null(),
                    )
                    .drop_column(Event::Vehicle)
                    .drop_column(Event::Wheelchairs)
                    .drop_column(Event::Passengers)
                    .drop_column(Event::Luggage)
                    .to_owned(),
            )
            .await?;

        let foreign_key_event_assignment = TableForeignKey::new()
            .name("fk-event-assignment")
            .from_tbl(Event::Table)
            .from_col(Event::ChainId)
            .to_tbl(Assignment::Table)
            .to_col(Assignment::Id)
            .to_owned();

        let foreign_key_event_specs = TableForeignKey::new()
            .name("fk-event-specs")
            .from_tbl(Event::Table)
            .from_col(Event::RequiredVehicleSpecifics)
            .to_tbl(VehicleSpecifics::Table)
            .to_col(VehicleSpecifics::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_foreign_key(&foreign_key_event_specs)
                    .add_foreign_key(&foreign_key_event_assignment)
                    .to_owned(),
            )
            .await?;

        let foreign_key_assignment_company = TableForeignKey::new()
            .name("fk-assignment-company")
            .from_tbl(Assignment::Table)
            .from_col(Assignment::Company)
            .to_tbl(Company::Table)
            .to_col(Company::Id)
            .to_owned();

        let foreign_key_assignment_vehicle = TableForeignKey::new()
            .name("fk-assignment-vehicle")
            .from_tbl(Assignment::Table)
            .from_col(Assignment::Vehicle)
            .to_tbl(Vehicle::Table)
            .to_col(Vehicle::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Assignment::Table)
                    .add_foreign_key(&foreign_key_assignment_vehicle)
                    .add_foreign_key(&foreign_key_assignment_company)
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
            .drop_table(Table::drop().table(Assignment::Table).to_owned())
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .drop_column(Vehicle::Active)
                    .to_owned(),
            )
            .await?;
        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .modify_column(ColumnDef::new(Event::ChainId).null())
                    .drop_column(Event::ChainId)
                    .drop_column(Event::RequiredVehicleSpecifics)
                    .add_column(ColumnDef::new(Event::Vehicle).integer().not_null())
                    .add_column(ColumnDef::new(Event::Wheelchairs).integer().not_null())
                    .add_column(ColumnDef::new(Event::Passengers).integer().not_null())
                    .add_column(ColumnDef::new(Event::Luggage).integer().not_null())
                    .to_owned(),
            )
            .await?;

        let foreign_key_event_vehicle = TableForeignKey::new()
            .name("fk-event-specs")
            .from_tbl(Event::Table)
            .from_col(Event::Vehicle)
            .to_tbl(Vehicle::Table)
            .to_col(Vehicle::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_foreign_key(&foreign_key_event_vehicle)
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Vehicle {
    Table,
    Id,
    Active,
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
}
#[derive(DeriveIden)]
enum VehicleSpecifics {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Assignment {
    Table,
    Id,
    Arrival,
    Departure,
    Company,
    Vehicle,
}

#[derive(DeriveIden)]
enum Event {
    Table,
    ChainId,
    Vehicle,
    Wheelchairs,
    Passengers,
    Luggage,
    RequiredVehicleSpecifics,
}
