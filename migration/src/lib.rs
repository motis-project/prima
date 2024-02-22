pub use sea_orm_migration::prelude::*;

mod m20220101_000001_init;
mod m20240209_145121_user_pwd_email;
mod m20240222_160326_user_active_flag;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20220101_000001_init::Migration),
            Box::new(m20240209_145121_user_pwd_email::Migration),
            Box::new(m20240222_160326_user_active_flag::Migration),
        ]
    }
}
