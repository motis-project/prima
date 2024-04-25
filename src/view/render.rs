use std::sync::Mutex;

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

pub async fn get_route_details(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let waypoints = vec![
        WayPoint {
            id: 0,
            date: "01.03.2024".to_string(),
            time: "12:00".to_string(),
            coordinates: "49°52'37.8\"N 8°39'20.7\"E".to_string(),
            pickup: true,
            drop: false,
        },
        WayPoint {
            id: 1,
            date: "01.03.2024".to_string(),
            time: "12:15".to_string(),
            coordinates: "49°52'37.9\"N 8°40'01.5\"E".to_string(),
            pickup: true,
            drop: false,
        },
        WayPoint {
            id: 3,
            date: "01.03.2024".to_string(),
            time: "12:25".to_string(),
            coordinates: "49°52'20.0\"N 8°39'35.8\"E".to_string(),
            pickup: false,
            drop: true,
        },
        WayPoint {
            id: 4,
            date: "01.03.2024".to_string(),
            time: "12:45".to_string(),
            coordinates: "49°52'18.9\"N 8°37'52.7\"E".to_string(),
            pickup: false,
            drop: true,
        },
    ];

    let route = Route {
        id: 0,
        waypoints: waypoints,
    };

    let response = s
        .render(
            "tour.html",
            &Context::from_serialize(json!({"route": route})).map_err(|e| {
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

#[derive(Serialize)]
struct Tour {
    id: i32,
    date: String,
    start_time: String,
    end_time: String,
    plate: String,
    conflict: i32,
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
}

pub async fn render_tours(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let company_id = 1;
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

    // All tours for a sepc. company within a spec. day
    let mut tours_all: Vec<Box<&dyn PrimaTour>> = Vec::new();

    // since Tours are assigned to vehicles, we have to gather them from the comanies vehicles
    for v in vehicles.unwrap().iter() {
        let v_id = v.get_id().await;
        let tours_vehicle = data.get_tours(v_id, start_time, end_time).await;
        tours_all.extend(tours_vehicle.unwrap());
    }

    // for vehicle in company_1_vehicles.unwrap().iter() {
    //     println!("vehicle with id: {} and license-plate: {} belongs to company: {} and has {} currently scheduled tours.",
    //         vehicle.get_id().await, vehicle.get_license_plate().await, mutex_guarded_data3.get_company(vehicle.get_company_id().await).await.unwrap().get_name().await, vehicle.get_tours().await.len());
    // }

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
    let company_id = 1;
    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();
    let mut vec_availability: Vec<RenderVehicle> = Vec::new();

    // for v in data.get_vehicles_(company_id, Some(true)).await.iter() {
    //     let availability = v.availability.clone();

    //     let ve = RenderVehicle {
    //         id: v.id,
    //         license_plate: v.license_plate.to_string(),
    //         availability_start: "".to_string(),
    //         availability_end: "".to_string(),
    //     };
    //     vehicles.push(ve);

    //     for (i, ad) in availability {
    //         let va = RenderVehicle {
    //             id: v.id,
    //             license_plate: v.license_plate.to_string(),
    //             availability_start: ad.interval.start_time.to_string(),
    //             availability_end: ad.interval.end_time.to_string(),
    //         };
    //         vec_availability.push(va);
    //     }
    // }

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
    let company_id = 1;
    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();

    // availability
    // for v in data.get_vehicles_(company_id, Some(true)).await.iter() {
    //     let availability = v.availability.clone();
    //     for (i, ad) in availability {
    //         let ve = RenderVehicle {
    //             id: v.id,
    //             license_plate: v.license_plate.to_string(),
    //             availability_start: ad.interval.start_time.to_string(),
    //             availability_end: ad.interval.end_time.to_string(),
    //         };
    //         vehicles.push(ve);
    //     }
    // }

    Json(vehicles)
}

pub async fn get_vehicles(
    State(s): State<AppState>,
    // params: axum::extract::Query<VehicleAvailabilityParams>,
) -> Json<Vec<RenderVehicle>> {
    let company_id = 1;
    let data = s.data.read().await;

    let mut vehicles: Vec<RenderVehicle> = Vec::new();

    // for v in data.get_vehicles_(company_id, Some(true)).await.iter() {
    //     let ve = RenderVehicle {
    //         id: v.id,
    //         license_plate: v.license_plate.to_string(),
    //         availability_start: "".to_string(),
    //         availability_end: "".to_string(),
    //     };
    //     vehicles.push(ve);
    // }

    Json(vehicles)
}
