use crate::backend::{
    data,
    id_types::{CompanyIdT, IdT, UserIdT, VehicleIdT},
};
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
pub struct CreateRequestForm {
    id: i32,
}

#[derive(Serialize)]
pub struct CreateRequestResponse {
    status: String,
}

pub async fn create_request(
    State(s): State<AppState>,
    Json(params): Json<CreateRequestForm>,
) -> Json<CreateRequestResponse> {
    let mut data = s.data.write().await;

    println!("Processing request");

    let status = data
        .handle_routing_request(
            NaiveDate::from_ymd_opt(2024, 4, 30)
                .unwrap()
                .and_hms_opt(18, 10, 0)
                .unwrap(),
            true,
            51.220825,
            13.895984,
            51.116168,
            14.938095,
            UserIdT::new(1),
            1,
            "start_address",
            "target_address",
        )
        .await;

    println!("{}", status);

    Json(CreateRequestResponse {
        status: "Ok".to_string(),
    })
}
