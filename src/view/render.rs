use crate::{
    backend::id_types::{CompanyIdT, IdT},
    entities::vehicle,
};
use axum::{
    extract::State,
    http::{StatusCode, Uri},
    response::Html,
    response::Json,
};
use chrono::{naive, Local, NaiveDate};
use sea_orm::{DbConn, EntityTrait};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Mutex;
use tera::Context;
use tracing::error;

use crate::{
    backend::{
        data::{self, TourData},
        lib::PrimaTour,
    },
    entities::{availability, prelude::User},
    AppState,
};

use super::tours::{Event, Tour};

async fn is_user_logged_in(user_id: i32) -> bool {
    // let _user = User::find_by_id(user_id).one(db).await.unwrap_or(None);
    // match _user {
    //     Some(_user) => true,
    //     None => false,
    // }
    true
}

pub async fn render_login(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("login.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_register(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("register.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_home(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    let user_logged_in = is_user_logged_in(1).await;
    let response = s
        .render(
            "home.html",
            &Context::from_serialize(json!({"user_logged_in": user_logged_in})).map_err(|e| {
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

pub async fn render_driver_sign_in(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("driver-mobile/sign_in.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_tc_dashboard(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/tc_dashboard.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_tc_tours_(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/tc_tours-1.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn view_add_vehicle(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/vehicle.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

#[derive(Serialize, Clone)]
pub struct RenderVehicle {
    id: i32,
    license_plate: String,
    availability_start: String,
    availability_end: String,
}

#[derive(Serialize)]
struct Route {
    id: i32,
    waypoints: Vec<WayPoint>,
}

#[derive(Serialize)]
struct WayPoint {
    id: i32,
    date: String,
    time: String,
    coordinates: String,
    pickup: bool,
    drop: bool,
}

#[derive(Deserialize)]
pub struct VehicleAvailabilityParams {
    id: i32,
    date: String,
}

pub async fn render_availability(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let company_id = CompanyIdT::new(6);
    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();
    let mut vec_availability: Vec<RenderVehicle> = Vec::new();

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
        let ve = RenderVehicle {
            id: vehicle_id.id(),
            license_plate: dv.get_license_plate().await.to_string(),
            availability_start: "".to_string(),
            availability_end: "".to_string(),
        };
        vehicles.push(ve);

        for ad in availability {
            let va = RenderVehicle {
                id: vehicle_id.id(),
                license_plate: dv.get_license_plate().await.to_string(),
                availability_start: ad.start_time.to_string(),
                availability_end: ad.end_time.to_string(),
            };
            println!("{}", va.availability_start);
            vec_availability.push(va);
        }
    }

    let response = s
        .render(
            "taxi-center/availability.html",
            &Context::from_serialize(
                json!({"vehicles": vehicles, "availability": vec_availability}),
            )
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

pub async fn get_availability(
    State(s): State<AppState>,
    params: axum::extract::Query<VehicleAvailabilityParams>,
) -> Json<Vec<RenderVehicle>> {
    let company_id = CompanyIdT::new(params.id);
    let parsed_date = NaiveDate::parse_from_str(&params.date, "%Y-%m-%d");

    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();

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
            let va = RenderVehicle {
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
