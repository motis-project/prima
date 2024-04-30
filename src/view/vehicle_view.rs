use axum::{
    extract::State,
    http::{StatusCode, Uri},
    response::{Html, Redirect},
    Form, Json,
};
use chrono::{NaiveDate, NaiveDateTime};
use sea_orm::{DbConn, EntityTrait};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tera::Context;
use tower_http::services::redirect;
use tracing::error;

use crate::{
    entities::{availability, prelude::User},
    AppState,
    // init::AppState,
};
use tokio::sync::RwLock;

#[derive(Deserialize)]
pub struct CreateVehicleForm {
    license_plate: String,
}

#[derive(Deserialize)]
pub struct AddVehicleAvailabilityForm {
    id: i32,
    create: bool,
    availability_start: String,
    availability_end: String,
}

pub async fn create_vehicle(
    State(s): State<AppState>,
    Form(vehicle): Form<CreateVehicleForm>,
) -> Redirect {
    let company_id = 1;
    let mut data = s.data.write().await;
    data.create_vehicle(&vehicle.license_plate, company_id)
        .await;

    let redirect_url = "/availability";
    Redirect::to(redirect_url)
}

pub async fn add_vehicle_availability(
    State(s): State<AppState>,
    Json(params): Json<AddVehicleAvailabilityForm>,
) -> Redirect {
    let mut data = s.data.write().await;

    let dt_start =
        NaiveDateTime::parse_from_str(&params.availability_start, "%Y-%m-%d %H:%M:%S").unwrap();

    let dt_end =
        NaiveDateTime::parse_from_str(&params.availability_end, "%Y-%m-%d %H:%M:%S").unwrap();

    if params.create {
        data.create_availability(dt_start, dt_end, params.id).await;
    } else {
        data.remove_availability(dt_start, dt_end, params.id).await;
    }

    let redirect_url = "/availability";
    Redirect::to(redirect_url)
}
