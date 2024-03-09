use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .add_column(ColumnDef::new(Event::StartAddress).string().not_null())
                    .add_column(ColumnDef::new(Event::TargetAddress).string().not_null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            manager
            .alter_table(
                Table::alter()
                    .table(Event::Table)
                    .drop_column(Event::StartAddress)
                    .drop_column(Event::TargetAddress)
                    .to_owned()
            )
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Event {
    Table,
    StartAddress,
    TargetAddress,
}