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
                    .drop_column(User::Name)
                    .add_column(ColumnDef::new(User::Name).string().unique_key().not_null())
                    .drop_column(User::Email)
                    .add_column(
                        ColumnDef::new(User::Email)
                            .string()
                            .unique_key()
                            .not_null()
                            .default("root@localhost"),
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
            .alter_table(
                Table::alter()
                    .table(User::Table)
                    .drop_column(User::Name)
                    .add_column(ColumnDef::new(User::Name).string().not_null())
                    .drop_column(User::Email)
                    .add_column(
                        ColumnDef::new(User::Email)
                            .string()
                            .not_null()
                            .default("root@localhost"),
                    )
                    .to_owned(),
            )
            .await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum User {
    Table,
    Name,
    Email,
}
