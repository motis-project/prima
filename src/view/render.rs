use axum::{
    extract::{Json, State},
    http::{StatusCode, Uri},
    response::{Html, Redirect},
    routing::{get, post},
    Form, Router,
};
use sea_orm::DbConn;
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use tera::Context;
use tracing::{error, info};

use crate::{entities::prelude::User, AppState};

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
    car: Option<Car>,
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

pub async fn render_tc_tours(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    // let username = User::find_by_id(1)
    //     .one(s.db())
    //     .await
    //     .map_err(|e| {
    //         error!("Database error: {e:?}");
    //         StatusCode::INTERNAL_SERVER_ERROR
    //     })?
    //     .ok_or(StatusCode::NOT_FOUND)?
    //     .name
    //     .clone();

    let car_0 = Car {
        id: 0,
        plate: "DA-AA 0815".to_string(),
        seats: 4,
    };

    let car_1 = Car {
        id: 1,
        plate: "DA-AA 0816".to_string(),
        seats: 4,
    };

    let car_2 = Car {
        id: 2,
        plate: "DA-AA 0817".to_string(),
        seats: 4,
    };

    let mut cars = Vec::new();

    cars.push(car_0.to_owned());
    cars.push(car_1.to_owned());
    cars.push(car_2.to_owned());

    let mut tours = Vec::new();

    tours.push(Tour {
        id: 0,
        date: "01.03.2024".to_string(),
        start_time: "12:00".to_string(),
        end_time: "12:45".to_string(),
        car: None,
    });

    tours.push(Tour {
        id: 1,
        date: "01.03.2024".to_string(),
        start_time: "11:30".to_string(),
        end_time: "12:45".to_string(),
        car: Some(car_1.to_owned()),
    });

    tours.push(Tour {
        id: 2,
        date: "01.03.2024".to_string(),
        start_time: "10:30".to_string(),
        end_time: "12:00".to_string(),
        car: None,
    });

    let response = s
        .render(
            "taxi-center/tc_tours-1.html",
            &Context::from_serialize(json!({"tours": tours, "cars": cars})).map_err(|e| {
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
