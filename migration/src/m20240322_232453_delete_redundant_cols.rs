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
            .alter_table(
                Table::alter()
                    .table(Assignment::Table)
                    .drop_column(Assignment::Company)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .drop_column(Event::Company)
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
            .alter_table(
                Table::alter()
                    .table(Assignment::Table)
                    .add_column(ColumnDef::new(Assignment::Company).integer().not_null())
                    .to_owned(),
            )
            .await?;

        let foreign_key_company = TableForeignKey::new()
            .name("fk-company-zone_id")
            .from_tbl(Assignment::Table)
            .from_col(Assignment::Company)
            .to_tbl(Company::Table)
            .to_col(Company::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Company::Table)
                    .add_foreign_key(&foreign_key_company)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_column(ColumnDef::new(Event::Company).integer().not_null())
                    .to_owned(),
            )
            .await?;

        let foreign_key_event_company = TableForeignKey::new()
            .name("fk-company-zone_id")
            .from_tbl(Event::Table)
            .from_col(Event::Company)
            .to_tbl(Company::Table)
            .to_col(Company::Id)
            .to_owned();

        manager
            .alter_table(
                Table::alter()
                    .table(Company::Table)
                    .add_foreign_key(&foreign_key_event_company)
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Assignment {
    Table,
    Company,
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Event {
    Table,
    Company,
    Id,
}
