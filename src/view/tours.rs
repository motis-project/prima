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
use notify::event;
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

#[derive(Deserialize)]
pub struct ToursForVehicleParams {
    vehicle_id: i32,
    time_frame_start: String,
    time_frame_end: String,
}

#[derive(Serialize)]
pub struct Tour {
    pub id: i32,
    pub departure: String,
    pub arrival: String,
    pub events: Vec<Event>,
}

#[derive(Serialize)]
pub struct Event {
    pub id: i32,
    pub lat: f32,
    pub lng: f32,
    pub customer: String,
    pub adress: String,
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
                .and_hms_opt(19, 10, 0)
                .unwrap(),
            true,
            51.179940,
            14.000301,
            51.027205,
            13.750426,
            UserIdT::new(2),
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

pub async fn get_tours(
    State(s): State<AppState>,
    params: axum::extract::Query<ToursForVehicleParams>,
) -> Json<Vec<Tour>> {
    let data = s.data.read().await;

    let mut tours: Vec<Tour> = Vec::new();

    // let vehicle_id = VehicleIdT::new(params.vehicle_id);
    // let time_frame_start =
    //     NaiveDateTime::parse_from_str(&params.time_frame_start, "%Y-%m-%dT%H-%M-%S").unwrap();
    // let time_frame_end =
    //     NaiveDateTime::parse_from_str(&params.time_frame_end, "%Y-%m-%dT%H-%M-%S").unwrap();

    let mut events: Vec<Event> = Vec::new();
    events.push(Event {
        id: 1,
        lat: 51.179940,
        lng: 14.000301,
        customer: "Erika Mustermann".to_string(),
        adress: "Am Eierberg 3, 01896 Pulsnitz".to_string(),
    });
    events.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Erika Mustermann".to_string(),
        adress: "Pestitzer Weg 14, 01217 Dresden".to_string(),
    });

    let mut events2: Vec<Event> = Vec::new();
    events2.push(Event {
        id: 1,
        lat: 51.179940,
        lng: 14.000301,
        customer: "Max Mustermann".to_string(),
        adress: "Start adress".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Max Mustermann".to_string(),
        adress: "Destination adress".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Max Mustermann".to_string(),
        adress: "Destination adress".to_string(),
    });

    let tour1 = Tour {
        id: 1,
        departure: "2024-05-02 20:15:00".to_string(),
        arrival: "2024-05-02 20:45:00".to_string(),
        events: events,
    };

    let tour2 = Tour {
        id: 2,
        departure: "2024-05-03 10:15:00".to_string(),
        arrival: "2024-05-03 11:00:00".to_string(),
        events: events2,
    };

    if params.vehicle_id == 1 {
        tours.push(tour1);
    }
    if params.vehicle_id == 2 {
        tours.push(tour2);
    }

    Json(tours)
}
