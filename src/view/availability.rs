use crate::backend::id_types::{CompanyIdT, IdT, VehicleIdT};
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

#[derive(Deserialize)]
pub struct VehicleAvailabilityParams {
    id: i32,
    date: String,
}

#[derive(Serialize, Clone)]
pub struct Vehicle {
    pub id: i32,
    pub license_plate: String,
    pub availability_start: String,
    pub availability_end: String,
}

pub async fn render_add_vehicle(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/vehicle.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_availability(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let company_id = CompanyIdT::new(6);
    let data = s.data.read().await;

    let mut vehicles: Vec<Vehicle> = Vec::new();
    let mut vec_availability: Vec<Vehicle> = Vec::new();

    for dv in data.get_vehicles(company_id).await.unwrap().iter() {
        let availability = data
            .get_availability_intervals(
                dv.get_id().await.to_owned(),
                NaiveDate::from_ymd_opt(2024, 4, 30)
                    .unwrap()
                    .and_hms_opt(0, 0, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 30)
                    .unwrap()
                    .and_hms_opt(23, 59, 59)
                    .unwrap(),
            )
            .await
            .unwrap();

        let vehicle_id = dv.get_id().await;
        let ve = Vehicle {
            id: vehicle_id.id(),
            license_plate: dv.get_license_plate().await.to_string(),
            availability_start: "".to_string(),
            availability_end: "".to_string(),
        };
        vehicles.push(ve);

        for ad in availability {
            let va = Vehicle {
                id: vehicle_id.id(),
                license_plate: dv.get_license_plate().await.to_string(),
                availability_start: ad.start_time.to_string(),
                availability_end: ad.end_time.to_string(),
            };
            println!("{}", va.availability_start);
            vec_availability.push(va);
        }
    }

    let h_morning: [&str; 9] = ["23", "00", "01", "02", "03", "04", "05", "06", "07"];
    let h_midday: [&str; 9] = ["08", "09", "10", "11", "12", "13", "14", "15", "16"];
    let h_evening: [&str; 8] = ["17", "18", "19", "20", "21", "22", "23", "00"];

    let response = s
        .render(
            "taxi-center/availability.html",
            &Context::from_serialize(json!({"vehicles": vehicles, 
                "availability": vec_availability,
                "h_morning": h_morning,
                "h_midday": h_midday,
                "h_evening": h_evening}))
            .map_err(|e| {
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

pub async fn create_vehicle(
    State(s): State<AppState>,
    Form(vehicle): Form<CreateVehicleForm>,
) -> Redirect {
    let company_id = CompanyIdT::new(6);
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
        data.create_availability(dt_start, dt_end, VehicleIdT::new(params.id))
            .await;
    } else {
        data.remove_availability(dt_start, dt_end, VehicleIdT::new(params.id))
            .await;
    }

    let redirect_url = "/availability";
    Redirect::to(redirect_url)
}

pub async fn get_availability(
    State(s): State<AppState>,
    params: axum::extract::Query<VehicleAvailabilityParams>,
) -> Json<Vec<Vehicle>> {
    let company_id = CompanyIdT::new(params.id);
    let parsed_date = NaiveDate::parse_from_str(&params.date, "%Y-%m-%d");

    let data = s.data.read().await;

    let mut vehicles: Vec<Vehicle> = Vec::new();

    for dv in data.get_vehicles(company_id).await.unwrap().iter() {
        let vehicle_idt = dv.get_id().await;
        let vehicle_id = dv.get_id().await.id();
        let availability = data
            .get_availability_intervals(
                vehicle_idt.to_owned(),
                parsed_date.unwrap().and_hms_opt(0, 0, 0).unwrap(),
                parsed_date.unwrap().and_hms_opt(23, 59, 59).unwrap(),
            )
            .await
            .unwrap();

        for ad in availability {
            let va = Vehicle {
                id: vehicle_id,
                license_plate: dv.get_license_plate().await.to_string(),
                availability_start: ad.start_time.to_string(),
                availability_end: ad.end_time.to_string(),
            };
            vehicles.push(va);
        }
    }

    Json(vehicles)
}
