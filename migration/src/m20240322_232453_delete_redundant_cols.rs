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

        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_column(ColumnDef::new(Event::Company).integer().not_null())
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
enum Event {
    Table,
    Company,
}
