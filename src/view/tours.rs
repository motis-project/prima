use crate::backend::{
    data,
    id_types::{CompanyIdT, IdT, UserIdT, VehicleIdT},
    lib::PrimaTour,
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
    pub vehicle_id: i32,
}

#[derive(Serialize)]
pub struct Event {
    pub id: i32,
    pub lat: f32,
    pub lng: f32,
    pub customer: String,
    pub adress: String,
}

#[derive(Deserialize)]
pub struct TourDetailParams {
    id: usize,
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
    let company_id = CompanyIdT::new(6);
    let vehicles = data.get_vehicles(company_id).await;
    let mut tours: Vec<Tour> = Vec::new();

    let time_frame_start =
        NaiveDateTime::parse_from_str(&params.time_frame_start, "%Y-%m-%dT%H:%M:%S").unwrap();
    let time_frame_end =
        NaiveDateTime::parse_from_str(&params.time_frame_end, "%Y-%m-%dT%H:%M:%S").unwrap();

    let v1 = vehicles.unwrap().clone();

    let tours_data = data
        .get_tours_for_company(company_id, time_frame_start, time_frame_end)
        .await
        .unwrap();
    for tour in tours_data.iter() {
        println!("{}", tour.get_id().await.id().clone());
        tours.push(Tour {
            id: tour.get_id().await.id(),
            departure: tour.get_departure().await.to_string(),
            arrival: tour.get_arrival().await.to_string(),
            vehicle_id: 0, // tour.get_vehicle_id(),
        })
    }

    Json(tours)
}

pub async fn get_tour_details(
    State(s): State<AppState>,
    params: axum::extract::Query<TourDetailParams>,
) -> Result<Html<String>, StatusCode> {
    let mut tours: Vec<Tour> = Vec::new();

    let mut events: Vec<Event> = Vec::new();
    events.push(Event {
        id: 1,
        lat: 51.17052591968958,
        lng: 14.75467407061821,
        customer: "Erika Mustermann".to_string(),
        adress: "Hauptstraße 34, 02894 Reichenbach/Oberlausitz".to_string(),
    });
    events.push(Event {
        id: 2,
        lat: 51.135427545160844,
        lng: 14.796664570615112,
        customer: "Erika Mustermann".to_string(),
        adress: "Bhf Reichenbach".to_string(),
    });

    let mut events2: Vec<Event> = Vec::new();
    events2.push(Event {
        id: 1,
        lat: 51.179940,
        lng: 14.000301,
        customer: "Max Mustermann".to_string(),
        adress: "Am Eierberg 3, 01896 Pulsnitz".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.169424,
        lng: 13.824418,
        customer: "Erika Mustermann".to_string(),
        adress: "Nordstraße 17, 01458 Ottendorf-Okrilla".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.1805717991834,
        lng: 14.430872351819595,
        customer: "Max Mustermann".to_string(),
        adress: "Bhf Dresden-Neustadt".to_string(),
    });

    let tour1 = Tour {
        id: 1,
        departure: "04.05.2024,  10:15".to_string(),
        arrival: "04.05.2024,  10:45".to_string(),
        vehicle_id: 18,
    };
    tours.push(tour1);

    let tour2 = Tour {
        id: 2,
        departure: "2024-05-03 11:15:00".to_string(),
        arrival: "2024-05-03 12:00:00".to_string(),
        vehicle_id: 18,
    };
    tours.push(tour2);

    // select tour by param
    println!("{}", params.id);
    let tour = &tours[params.id - 1];

    let response = s
        .render(
            "tour.html",
            &Context::from_serialize(json!({"tour": tour})).map_err(|e| {
                error!("Serialize error: {e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?,
        )
        .map_err(|e| {
            error!("Render error: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    Ok(Html(response))
}
