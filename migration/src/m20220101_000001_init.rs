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
                    .table(User::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(User::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(User::Name).string().not_null())
                    .col(ColumnDef::new(User::IsDriver).boolean().not_null())
                    .col(ColumnDef::new(User::IsAdmin).boolean().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Zone::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Zone::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Zone::Area).string().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Vehicle::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Vehicle::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Vehicle::Seats).integer().not_null())
                    .col(ColumnDef::new(Vehicle::Wheelchair).boolean().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Event::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Event::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Event::Type).integer().not_null())
                    .col(ColumnDef::new(Event::Latitude).float().not_null())
                    .col(ColumnDef::new(Event::Longitude).float().not_null())
                    .col(ColumnDef::new(Event::ScheduledTime).date_time().not_null())
                    .col(
                        ColumnDef::new(Event::CommunicatedTime)
                            .date_time()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Event::Vehicle).integer().not_null())
                    .col(ColumnDef::new(Event::Customer).integer().not_null())
                    .col(ColumnDef::new(Event::Driver).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-event-vehicle_id")
                            .from(Event::Table, Event::Vehicle)
                            .to(Vehicle::Table, Vehicle::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-event-customer_id")
                            .from(Event::Table, Event::Customer)
                            .to(User::Table, User::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-event-driver_id")
                            .from(Event::Table, Event::Driver)
                            .to(User::Table, User::Id),
                    )
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
            .drop_table(Table::drop().table(Event::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Vehicle::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Zone::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(User::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
    Name,
    IsDriver,
    IsAdmin,
}

#[derive(DeriveIden)]
enum Zone {
    Table,
    Id,
    Area,
}

#[derive(DeriveIden)]
enum Vehicle {
    Table,
    Id,
    Seats,
    Wheelchair,
}

#[derive(DeriveIden)]
enum Event {
    Table,
    Id,
    Type,
    Customer,
    Latitude,
    Longitude,
    ScheduledTime,
    CommunicatedTime,
    Vehicle,
    Driver,
}
