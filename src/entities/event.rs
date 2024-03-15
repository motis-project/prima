//! `SeaORM` Entity. Generated by sea-orm-codegen 0.12.14

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "event")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(column_type = "Float")]
    pub latitude: f32,
    #[sea_orm(column_type = "Float")]
    pub longitude: f32,
    pub scheduled_time: DateTime,
    pub communicated_time: DateTime,
    pub company: i32,
    pub customer: i32,
    pub chain_id: i32,
    pub request_id: i32,
    pub is_pickup: bool,
    pub connects_public_transport: bool,
    pub address: String,
    pub required_vehicle_specifics: i32,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::assignment::Entity",
        from = "Column::ChainId",
        to = "super::assignment::Column::Id",
        on_update = "NoAction",
        on_delete = "NoAction"
    )]
    Assignment,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::Customer",
        to = "super::user::Column::Id",
        on_update = "NoAction",
        on_delete = "NoAction"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::vehicle_specifics::Entity",
        from = "Column::RequiredVehicleSpecifics",
        to = "super::vehicle_specifics::Column::Id",
        on_update = "NoAction",
        on_delete = "NoAction"
    )]
    VehicleSpecifics,
}

impl Related<super::assignment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Assignment.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl Related<super::vehicle_specifics::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::VehicleSpecifics.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
