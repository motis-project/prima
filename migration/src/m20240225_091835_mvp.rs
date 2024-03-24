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
                    .table(Company::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Company::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Company::Name)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Company::Longitude).float().not_null())
                    .col(ColumnDef::new(Company::Latitude).float().not_null())
                    .col(ColumnDef::new(Company::Zone).integer().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Capacity::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Capacity::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Capacity::Company).integer().not_null())
                    .col(ColumnDef::new(Capacity::StartTime).date_time().not_null())
                    .col(ColumnDef::new(Capacity::EndTime).date_time().not_null())
                    .col(ColumnDef::new(Capacity::Amount).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-capacity-company_id")
                            .from(Capacity::Table, Capacity::Company)
                            .to(Company::Table, Company::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Zone::Table)
                    .add_column(ColumnDef::new(Zone::Name).string().not_null().unique_key())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_column(ColumnDef::new(Event::ChainId).integer())
                    .add_column(ColumnDef::new(Event::RequestId).integer().not_null())
                    .add_column(ColumnDef::new(Event::Company).integer().not_null())
                    .add_column(ColumnDef::new(Event::Passengers).integer().not_null())
                    .add_column(ColumnDef::new(Event::Wheelchairs).integer().not_null())
                    .add_column(ColumnDef::new(Event::IsPickup).boolean().not_null())
                    .add_column(
                        ColumnDef::new(Event::ConnectsPublicTransport)
                            .boolean()
                            .not_null(),
                    )
                    .add_column(ColumnDef::new(Event::Luggage).integer().not_null())
                    .drop_column(Event::Driver)
                    .drop_column(Event::Type)
                    .modify_column(ColumnDef::new(Event::Vehicle).null())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .drop_column(Vehicle::Wheelchair)
                    .add_column(ColumnDef::new(Vehicle::Wheelchairs).integer().not_null())
                    .add_column(
                        ColumnDef::new(Vehicle::LicensePlate)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .add_column(ColumnDef::new(Vehicle::Company).integer().not_null())
                    .add_column(ColumnDef::new(Vehicle::StorageSpace).integer().not_null())
                    .to_owned(),
            )
            .await?;

        let foreign_key_next = TableForeignKey::new()
            .name("fk-vehicle-company_id")
            .from_tbl(Vehicle::Table)
            .from_col(Vehicle::Company)
            .to_tbl(Company::Table)
            .to_col(Company::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .add_foreign_key(&foreign_key_next)
                    .to_owned(),
            )
            .await?;

        let foreign_key_zone = TableForeignKey::new()
            .name("fk-company-zone_id")
            .from_tbl(Company::Table)
            .from_col(Company::Zone)
            .to_tbl(Zone::Table)
            .to_col(Zone::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Company::Table)
                    .add_foreign_key(&foreign_key_zone)
                    .to_owned(),
            )
            .await?;

        let foreign_key_company = TableForeignKey::new()
            .name("fk-event-company_id")
            .from_tbl(Event::Table)
            .from_col(Event::Company)
            .to_tbl(Company::Table)
            .to_col(Company::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_foreign_key(&foreign_key_company)
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
            .drop_table(Table::drop().table(Company::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Capacity::Table).to_owned())
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Zone::Table)
                    .drop_column(Zone::Name)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .drop_column(Event::ChainId)
                    .drop_column(Event::RequestId)
                    .drop_column(Event::Company)
                    .drop_column(Event::Passengers)
                    .drop_column(Event::Wheelchairs)
                    .drop_column(Event::IsPickup)
                    .drop_column(Event::ConnectsPublicTransport)
                    .drop_column(Event::Luggage)
                    .add_column(ColumnDef::new(Event::Type).integer().not_null())
                    .add_column(ColumnDef::new(Event::Driver).integer().not_null())
                    .modify_column(ColumnDef::new(Event::Vehicle).not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Vehicle::Table)
                    .drop_column(Vehicle::LicensePlate)
                    .drop_column(Vehicle::Company)
                    .drop_column(Vehicle::Wheelchairs)
                    .drop_column(Vehicle::StorageSpace)
                    .add_column(ColumnDef::new(Vehicle::Wheelchair).boolean().not_null())
                    .add_column(
                        ColumnDef::new(Vehicle::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Event {
    Table,
    ChainId,
    RequestId,
    Vehicle,
    Company,
    Driver,
    Passengers,
    Wheelchairs,
    ConnectsPublicTransport,
    IsPickup,
    Type,
    Luggage,
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
    Latitude,
    Longitude,
    Name,
    Zone,
}

#[derive(DeriveIden)]
enum Zone {
    Table,
    Id,
    Name,
}

#[derive(DeriveIden)]
enum Vehicle {
    Table,
    Id,
    LicensePlate,
    Company,
    Wheelchairs,
    Wheelchair,
    StorageSpace,
}

#[derive(DeriveIden)]
enum Capacity {
    Table,
    Id,
    Company,
    Amount,
    StartTime,
    EndTime,
}
