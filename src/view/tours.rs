use crate::backend::{
    data,
    id_types::{CompanyIdT, IdT, TourIdT, UserIdT, VehicleIdT},
    lib::PrimaTour,
};
use axum::{
    extract::State,
    http::{response, StatusCode, Uri},
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
    start_lat: f32,
    start_lng: f32,
    dst_lat: f32,
    dst_lng: f32,
    departure_time: String,
    start_adress: String,
    dst_adress: String,
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
    pub customer: String,
    pub adress: String,
    pub lat: f32,
    pub lng: f32,
}

#[derive(Serialize)]
pub struct TourDetail {
    pub departure: String,
    pub arrival: String,
    pub events: Vec<Event>,
}

#[derive(Deserialize)]
pub struct TourDetailParams {
    id: i32,
}

#[derive(Serialize)]
pub struct Response<T> {
    status: i32,
    payload: T,
}

pub async fn create_request(
    State(s): State<AppState>,
    Json(params): Json<CreateRequestForm>,
) -> Json<CreateRequestResponse> {
    let mut data = s.data.write().await;

    println!("Processing request");

    let status = data
        .handle_routing_request(
            NaiveDate::from_ymd_opt(2024, 5, 20)
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

    println!("Request status: {}", status);

    Json(CreateRequestResponse {
        status: "Ok".to_string(),
    })
}

pub async fn get_tours(
    State(s): State<AppState>,
    params: axum::extract::Query<ToursForVehicleParams>,
) -> Json<Response<Vec<Tour>>> {
    let data = s.data.read().await;
    let company_id = CompanyIdT::new(6);
    let mut tours: Vec<Tour> = Vec::new();

    let t_start_result =
        NaiveDateTime::parse_from_str(&params.time_frame_start, "%Y-%m-%dT%H:%M:%S");
    let t_start = match t_start_result {
        Ok(time) => time,
        Err(error) => {
            return Json(Response {
                status: 400,
                payload: tours,
            })
        }
    };

    let t_end_result = NaiveDateTime::parse_from_str(&params.time_frame_end, "%Y-%m-%dT%H:%M:%S");
    let t_end = match t_end_result {
        Ok(time) => time,
        Err(error) => {
            return Json(Response {
                status: 400,
                payload: tours,
            })
        }
    };

    let tours_data_result = data.get_tours_for_company(company_id, t_start, t_end).await;
    let tours_data = match tours_data_result {
        Ok(tours) => tours,
        Err(error) => {
            return Json(Response {
                status: 500,
                payload: tours,
            })
        }
    };

    for tour in tours_data.iter() {
        tours.push(Tour {
            id: tour.get_id().await.id(),
            departure: tour.get_departure().await.to_string(),
            arrival: tour.get_arrival().await.to_string(),
            vehicle_id: tour.get_vehicle_id().await.id(),
        })
    }

    Json(Response {
        status: 200,
        payload: tours,
    })
}

pub async fn get_tour_details(
    State(s): State<AppState>,
    params: axum::extract::Query<TourDetailParams>,
) -> Result<Html<String>, StatusCode> {
    let data = s.data.read().await;
    let mut events: Vec<Event> = Vec::new();

    let data_events_result = data.get_events_for_tour(TourIdT::new(params.id)).await;

    let data_events = match data_events_result {
        Ok(events) => events,
        Err(error) => return Err(error),
    };

    for event in data_events.iter() {
        println!("{}", event.get_id().await.id());
        events.push(Event {
            customer: "".to_string(),
            adress: "".to_string(),
            lat: event.get_lat().await,
            lng: event.get_lng().await,
        });
    }

    let tour = TourDetail {
        departure: "".to_string(),
        arrival: "".to_string(),
        events: events,
    };

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
