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
                    .table(User::Table)
                    .add_column(
                        ColumnDef::new(User::IsActive)
                            .boolean()
                            .not_null()
                            .default(true),
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
            .alter_table(Table::alter().drop_column(User::IsActive).to_owned())
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum User {
    Table,
    IsActive,
}
