use std::sync::Arc;

use axum::{extract::State, Json};
use sea_orm::*;

pub fn create(
    State(store): State<Arc<DatabaseConnection>>,
    Json(user): Json<User>,
) {
    todo!()
}
