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
                    .col(ColumnDef::new(Zone::Name).string().not_null().unique_key())
                    .to_owned(),
            )
            .await?;

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
                    .col(ColumnDef::new(Company::Latitude).float().not_null())
                    .col(ColumnDef::new(Company::Longitude).float().not_null())
                    .col(ColumnDef::new(Company::DisplayName).string().not_null())
                    .col(
                        ColumnDef::new(Company::Email)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Company::Zone).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-company-zone_id")
                            .from(Company::Table, Company::Zone)
                            .to(Zone::Table, Zone::Id),
                    )
                    .col(ColumnDef::new(Company::CommunityArea).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-company_community_id")
                            .from(Company::Table, Company::CommunityArea)
                            .to(Zone::Table, Zone::Id),
                    )
                    .to_owned(),
            )
            .await?;

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
                    .col(ColumnDef::new(User::DisplayName).string().not_null())
                    .col(ColumnDef::new(User::Company).integer())
                    .col(ColumnDef::new(User::IsDriver).boolean().not_null())
                    .col(ColumnDef::new(User::IsDisponent).boolean().not_null())
                    .col(ColumnDef::new(User::IsAdmin).boolean().not_null())
                    .col(ColumnDef::new(User::Email).string().not_null().unique_key())
                    .col(ColumnDef::new(User::Password).string())
                    .col(ColumnDef::new(User::Salt).string().not_null())
                    .col(ColumnDef::new(User::OAuthId).string())
                    .col(ColumnDef::new(User::OAuthProvider).string())
                    .col(
                        ColumnDef::new(User::IsActive)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-user-company_id")
                            .from(User::Table, User::Company)
                            .to(Company::Table, Company::Id),
                    )
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
                    .col(
                        ColumnDef::new(Vehicle::LicensePlate)
                            .string()
                            .not_null()
                            .unique_key(),
                    )
                    .col(ColumnDef::new(Vehicle::Company).integer().not_null())
                    .col(ColumnDef::new(Vehicle::Seats).integer().not_null())
                    .col(
                        ColumnDef::new(Vehicle::WheelchairCapacity)
                            .integer()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Vehicle::StorageSpace).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-vehicle-company_id")
                            .from(Vehicle::Table, Vehicle::Company)
                            .to(Company::Table, Company::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Availability::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Availability::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(Availability::StartTime)
                            .date_time()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Availability::EndTime).date_time().not_null())
                    .col(ColumnDef::new(Availability::Vehicle).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-availability-vehicle_id")
                            .from(Availability::Table, Availability::Vehicle)
                            .to(Vehicle::Table, Vehicle::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Tour::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Tour::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Tour::Departure).date_time().not_null())
                    .col(ColumnDef::new(Tour::Arrival).date_time().not_null())
                    .col(ColumnDef::new(Tour::Vehicle).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-tour-vehicle_id")
                            .from(Tour::Table, Tour::Vehicle)
                            .to(Vehicle::Table, Vehicle::Id),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Address::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Address::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Address::AddressString).string().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Request::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Request::Id)
                            .integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Request::Tour).integer().not_null())
                    .col(ColumnDef::new(Request::Customer).integer().not_null())
                    .col(ColumnDef::new(Request::Passengers).integer().not_null())
                    .col(ColumnDef::new(Request::Wheelchairs).integer().not_null())
                    .col(ColumnDef::new(Request::Luggage).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-request-tour_id")
                            .from(Request::Table, Request::Tour)
                            .to(Tour::Table, Tour::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-request-customer_id")
                            .from(Request::Table, Request::Customer)
                            .to(User::Table, User::Id),
                    )
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
                    .col(ColumnDef::new(Event::IsPickup).boolean().not_null())
                    .col(ColumnDef::new(Event::Latitude).float().not_null())
                    .col(ColumnDef::new(Event::Longitude).float().not_null())
                    .col(ColumnDef::new(Event::ScheduledTime).date_time().not_null())
                    .col(
                        ColumnDef::new(Event::CommunicatedTime)
                            .date_time()
                            .not_null(),
                    )
                    .col(ColumnDef::new(Event::Address).integer().not_null())
                    .col(ColumnDef::new(Event::Request).integer().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-event-request_id")
                            .from(Event::Table, Event::Request)
                            .to(Request::Table, Request::Id),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-event-address_id")
                            .from(Event::Table, Event::Address)
                            .to(Address::Table, Address::Id),
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
        manager
            .drop_table(Table::drop().table(Company::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Availability::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Tour::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Request::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Address::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
    DisplayName,
    Company,
    IsDriver,
    IsDisponent,
    IsAdmin,
    Email,
    OAuthId,
    OAuthProvider,
    IsActive,
    Password,
    Salt,
}

#[derive(DeriveIden)]
enum Zone {
    Table,
    Id,
    Area,
    Name,
}

#[derive(DeriveIden)]
enum Vehicle {
    Table,
    Id,
    LicensePlate,
    Company,
    Seats,
    WheelchairCapacity,
    StorageSpace,
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
    DisplayName,
    Longitude,
    Latitude,
    Zone,
    CommunityArea,
    Email,
}

#[derive(DeriveIden)]
enum Availability {
    Table,
    Id,
    StartTime,
    EndTime,
    Vehicle,
}

#[derive(DeriveIden)]
enum Tour {
    Table,
    Id,
    Departure,
    Arrival,
    Vehicle,
}

#[derive(DeriveIden)]
enum Request {
    Table,
    Id,
    Tour,
    Customer,
    Passengers,
    Wheelchairs,
    Luggage,
}

#[derive(DeriveIden)]
enum Address {
    Table,
    Id,
    AddressString,
}

#[derive(DeriveIden)]
enum Event {
    Table,
    Id,
    IsPickup,
    Latitude,
    Longitude,
    ScheduledTime,
    CommunicatedTime,
    Request,
    Address,
}
