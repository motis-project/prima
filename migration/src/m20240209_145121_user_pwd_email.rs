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
                        ColumnDef::new(User::Email)
                            .string()
                            .not_null()
                            .default("root@localhost"),
                    )
                    .add_column(ColumnDef::new(User::Password).string())
                    .add_column(
                        ColumnDef::new(User::Salt)
                            .string()
                            .not_null()
                            .default("salt"),
                    )
                    .add_column(ColumnDef::new(User::OAuthId).string())
                    .add_column(ColumnDef::new(User::OAuthProvider).string())
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
                    .drop_column(User::Email)
                    .drop_column(User::Password)
                    .drop_column(User::Salt)
                    .drop_column(User::OAuthId)
                    .drop_column(User::OAuthProvider)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum User {
    Table,
    Email,
    Password,
    Salt,
    OAuthId,
    OAuthProvider,
}
