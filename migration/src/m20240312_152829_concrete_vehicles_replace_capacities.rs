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
            .alter_table(
                Table::alter()
                    .table(Assignment::Table)
                    .modify_column(ColumnDef::new(Assignment::Vehicle).not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(Capacity::Table).to_owned())
            .await?;
        Ok(())
    }

    async fn down(
        &self,
        manager: &SchemaManager,
    ) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Availability::Table).to_owned())
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
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Capacity {
    Table,
    Id,
    Company,
    StartTime,
    EndTime,
    Amount,
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Assignment {
    Table,
    Vehicle,
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
enum Vehicle {
    Table,
    Id,
}
