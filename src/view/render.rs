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

#[derive(Deserialize)]
pub struct TourDetailParams {
    id: usize,
}

pub async fn get_route_details(
    State(s): State<AppState>,
    params: axum::extract::Query<TourDetailParams>,
) -> Result<Html<String>, StatusCode> {
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
        adress: "Addresse 1".to_string(),
    });
    events.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Erika Mustermann".to_string(),
        adress: "Addresse 2".to_string(),
    });

    let mut events2: Vec<Event> = Vec::new();
    events2.push(Event {
        id: 1,
        lat: 51.179940,
        lng: 14.000301,
        customer: "Max Mustermann".to_string(),
        adress: "Addresse 1".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Max Mustermann".to_string(),
        adress: "Addresse 2".to_string(),
    });
    events2.push(Event {
        id: 2,
        lat: 51.027205,
        lng: 13.750426,
        customer: "Max Mustermann".to_string(),
        adress: "Addresse 3".to_string(),
    });

    let tour1 = Tour {
        id: 1,
        departure: "2024-04-30 19:15:00".to_string(),
        arrival: "2024-04-30 19:45:00".to_string(),
        events: events,
    };
    tours.push(tour1);

    let tour2 = Tour {
        id: 2,
        departure: "2024-05-01 11:00:00".to_string(),
        arrival: "2024-05-01 11:45:00".to_string(),
        events: events2,
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

// #[derive(Serialize)]
// struct Tour {
//     id: i32,
//     date: String,
//     start_time: String,
//     end_time: String,
//     plate: String,
//     conflict: i32,
// }

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

pub async fn render_tours(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let company_id = CompanyIdT::new(1);
    let data = s.data.read().await;
    let vehicles = data.get_vehicles(company_id).await;

    let start_time = NaiveDate::from_ymd_opt(2024, 4, 15)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let end_time = NaiveDate::from_ymd_opt(2024, 4, 15)
        .unwrap()
        .and_hms_opt(23, 59, 59)
        .unwrap();

    // // All tours for a sepc. company within a spec. day
    let mut tours_all: Vec<Box<&dyn PrimaTour>> = Vec::new();

    let v1 = vehicles.unwrap().clone();

    for v in v1.iter() {
        let tmp = v.get_tours();
        // for tour in v.get_tours().await.clone().iter() {
        //     println!("{}", tour.get_id().await.id().clone());
        // }
    }

    let mut tours: Vec<Tour> = Vec::new();
    let mut vehicles: Vec<Tour> = Vec::new();

    // for tour in tours_all.iter() {
    //     let mut conflict = 0;

    //     for v in vehicles.iter() {
    //         let conflicts = data
    //             .get_vehicle_conflicts_for_assignment(v.id, tour.id)
    //             .await;
    //         if conflicts.len() > 0 {
    //             conflict = conflicts[0].id;
    //         }
    //     }

    //     tours.push(Tour {
    //         id: tour.id,
    //         date: tour.departure.date().to_string(),
    //         start_time: tour.departure.time().to_string(),
    //         end_time: tour.arrival.time().to_string(),
    //         plate: data
    //             .get_vehicle_by_id(tour.vehicle as usize)
    //             .license_plate
    //             .to_string(),
    //         conflict,
    //     });
    // }

    let response = s
        .render(
            "taxi-center/tours.html",
            &Context::from_serialize(json!({"tours": tours, "cars": vehicles})).map_err(|e| {
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

pub async fn render_availability(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let company_id = CompanyIdT::new(1);
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

        println!("Availability of vehicle ID {}", vehicle_id.id());
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

pub async fn get_vehicles(
    State(s): State<AppState>,
    // params: axum::extract::Query<VehicleAvailabilityParams>,
) -> Json<Vec<RenderVehicle>> {
    let company_id = CompanyIdT::new(1);
    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();

    for dv in data.get_vehicles(company_id).await.unwrap().iter() {
        let ve = RenderVehicle {
            id: dv.get_id().await.id(),
            license_plate: dv.get_license_plate().await.to_string(),
            availability_start: "".to_string(),
            availability_end: "".to_string(),
        };
        vehicles.push(ve);
    }

    Json(vehicles)
}
