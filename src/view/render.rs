use std::collections::HashMap;

use axum::{
    extract::{Json, State},
    http::{StatusCode, Uri},
    response::{Html, Redirect},
};
use chrono::NaiveDate;
use sea_orm::{DbConn, EntityTrait};
use serde::Serialize;
use serde_json::json;
use tera::Context;
use tracing::{error, info};

use crate::{
    backend::data::{AssignmentData, Data, VehicleData},
    entities::prelude::User,
    init::AppState,
};

pub async fn get_route_details(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    // let user = User::find_by_id(1)
    //     .one(s.db())
    //     .await
    //     .map_err(|e| {
    //         error!("Database error: {e:?}");
    //         StatusCode::INTERNAL_SERVER_ERROR
    //     })?
    //     .ok_or(StatusCode::NOT_FOUND)?;

    // let username = user.name.to_owned();

    // let mut user: user::ActiveModel = user.into();
    // user.password = Set(Some("newpwd".to_string()));
    // let _ = user.update(s.db()).await;

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

async fn is_user_logged_in(
    db: &DbConn,
    user_id: i32,
) -> bool {
    let _user = User::find_by_id(user_id).one(db).await.unwrap_or(None);
    match _user {
        Some(_user) => true,
        None => false,
    }
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
    let user_logged_in = is_user_logged_in(s.db(), 1).await;
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
    conflict: bool,
}

#[derive(Serialize, Clone)]
struct Car {
    id: i32,
    plate: String,
    seats: i32,
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

pub async fn render_tours(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let data = s.data();

    let company_id = 1;
    //let vehicles: HashMap<i32, Vec<&VehicleData>> = data.get_vehicles(company_id, Some(true)).await;
    let vehicles = data.get_vehicles_(company_id, Some(true)).await;

    let start_time = NaiveDate::from_ymd_opt(2024, 4, 15)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap();
    let end_time = NaiveDate::from_ymd_opt(2024, 4, 15)
        .unwrap()
        .and_hms_opt(23, 59, 59)
        .unwrap();

    let mut tours_all: Vec<&AssignmentData> = Vec::new();

    // if vehicles is HashMap
    // for (id, v) in vehicles.iter() {
    //     let tours_vehicle = data
    //         .get_assignments_for_vehicle(*id, start_time, end_time)
    //         .await;
    //     tours_all.extend(tours_vehicle);
    // }

    for v in vehicles.iter() {
        let tours_vehicle = data
            .get_assignments_for_vehicle(v.id, start_time, end_time)
            .await;
        // println!("v_id: {}", v.id);
        // for tv in tours_vehicle.iter() {
        //     println!("Asignment id: {}", tv.id);
        // }
        tours_all.extend(tours_vehicle);
    }

    let mut tours: Vec<Tour> = Vec::new();

    for tour in tours_all.iter() {
        let conflict = false;

        println!("\nTour {}:", tour.id);

        for v in vehicles.iter() {
            let conflicts = data
                .get_vehicle_conflicts_for_assignment(v.id, tour.id)
                .await;
            println!("vehicle_id: {}, conflicts:", v.id);
            for confl_asmt in conflicts {
                println!("{}", confl_asmt.id);
            }
        }

        tours.push(Tour {
            id: tour.vehicle,
            date: tour.departure.date().to_string(),
            start_time: tour.departure.time().to_string(),
            end_time: tour.arrival.time().to_string(),
            plate: data
                .get_vehicle_by_id(tour.vehicle as usize)
                .license_plate
                .to_string(),
            conflict,
        });
    }

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
