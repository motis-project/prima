use crate::be::backend::{
    CreateCapacity, CreateCompany, CreateVehicle, CreateZone, Data, GetById, GetCapacity,
};
use crate::constants::{
    bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
};
use crate::entities::prelude::User;

use axum::{
    extract::State,
    http::{StatusCode, Uri},
    response::Html,
    routing::get,
    Router,
};
use chrono::NaiveDate;
use dotenv::dotenv;
use entities::user;

use itertools::Itertools;
use log::setup_logging;
use migration::{Migrator, MigratorTrait};
use notify::Watcher;
use sea_orm::{ActiveValue, Database, DbConn, EntityTrait};
use serde_json::json;
use std::{
    env,
    path::Path,
    sync::{Arc, Mutex},
};
use tera::{Context, Tera};
use tower_http::{compression::CompressionLayer, services::ServeFile};
use tower_livereload::LiveReloadLayer;
use tracing::{error, info};

mod be;
mod constants;
mod entities;
mod log;
mod osrm;

#[derive(Clone)]
struct AppState {
    tera: Arc<Mutex<Tera>>,
    db: Arc<DbConn>,
}

impl AppState {
    fn render(
        &self,
        template_name: &str,
        context: &Context,
    ) -> Result<String, tera::Error> {
        self.tera.lock().unwrap().render(template_name, context)
    }

    fn db(&self) -> &DbConn {
        &*self.db
    }
}

async fn calendar(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("calendar.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

async fn register(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("register.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}
/*
async fn read_zone(){
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let conn = Database::connect(db_url)
        .await
        .expect("Database connection failed");
    let zone: Vec<zone::Model> = Zone::find()
    .all(&conn)
    .await.unwrap();
    for (i,n) in zone.iter().enumerate(){
        let geojson = n.area.parse::<GeoJson>().unwrap();
        let feature:Geometry = Geometry::try_from(geojson).unwrap();
        let mp:geo::MultiPolygon = geo::MultiPolygon::try_from(feature).unwrap();
        println!("does zone {} contain point 1?: {}    (expect true only for zone 2, görlitz)",i ,mp.contains(&geo::Point::new(14.799790732053424, 51.01877453460702)));
    }
    for (i,n) in zone.iter().enumerate(){
        let geojson = n.area.parse::<GeoJson>().unwrap();
        let feature:Geometry = Geometry::try_from(geojson).unwrap();
        let mp:geo::MultiPolygon = geo::MultiPolygon::try_from(feature).unwrap();
        println!("does zone {} contain point 2?: {}    (expect all false)",i ,mp.contains(&geo::Point::new(14.950086635328063, 51.083755783045575)));
    }
}
*/

async fn insert_user() {
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let conn = Database::connect(db_url)
        .await
        .expect("Database connection failed");
    let result = User::insert(user::ActiveModel {
        name: ActiveValue::Set("Test".to_string()),
        id: ActiveValue::NotSet,
        is_driver: ActiveValue::Set(true),
        is_admin: ActiveValue::Set(true),
        email: ActiveValue::Set("".to_string()),
        password: ActiveValue::Set(Some("".to_string())),
        salt: ActiveValue::Set("".to_string()),
        o_auth_id: ActiveValue::Set(Some("".to_string())),
        o_auth_provider: ActiveValue::Set(Some("".to_string())),
    })
    .exec(&conn)
    .await;
}

async fn users(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let result = User::insert(user::ActiveModel {
        name: ActiveValue::Set("Test".to_string()),
        id: ActiveValue::NotSet,
        is_driver: ActiveValue::Set(true),
        is_admin: ActiveValue::Set(true),
        email: ActiveValue::Set("".to_string()),
        password: ActiveValue::Set(Some("".to_string())),
        salt: ActiveValue::Set("".to_string()),
        o_auth_id: ActiveValue::Set(Some("".to_string())),
        o_auth_provider: ActiveValue::Set(Some("".to_string())),
    })
    .exec(s.db())
    .await;

    match result {
        Ok(_) => info!("User added"),
        Err(e) => error!("Error adding user: {e:?}"),
    }

    let username = User::find_by_id(1)
        .one(s.db())
        .await
        .map_err(|e| {
            error!("Database error: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?
        .name
        .clone();
    let response = s
        .render(
            "user.html",
            &Context::from_serialize(json!({"user": username})).map_err(|e| {
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

async fn init(State(s): State<AppState>) {
    let mut data = Data::new();
    data.create_user(
        State(s.clone()),
        axum::Json(be::backend::User {
            id: None,
            name: "Test".to_string(),
            is_driver: true,
            is_admin: true,
            email: "".to_string(),
            password: Some("".to_string()),
            salt: "".to_string(),
            o_auth_id: Some("".to_string()),
            o_auth_provider: Some("".to_string()),
        }),
    )
    .await;

    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Bautzen Ost".to_string(),
            area: BAUTZEN_OST.to_string(),
        }),
    )
    .await;
    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Bautzen West".to_string(),
            area: BAUTZEN_WEST.to_string(),
        }),
    )
    .await;
    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Görlitz".to_string(),
            area: GORLITZ.to_string(),
        }),
    )
    .await;

    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-1".to_string(),
            zone: 2,
            lng: 13.895983751721786,
            lat: 51.220826461859644,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-2".to_string(),
            zone: 2,
            lng: 14.034681384488607,
            lat: 51.31633774366952,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-3".to_string(),
            zone: 2,
            lng: 14.179674338162073,
            lat: 51.46704814415014,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-4".to_string(),
            zone: 1,
            lng: 14.244972698642613,
            lat: 51.27251252133357,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-5".to_string(),
            zone: 1,
            lng: 14.381821307922678,
            lat: 51.169106961190806,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-1".to_string(),
            zone: 3,
            lng: 14.708969872564097,
            lat: 51.43354047439519,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-2".to_string(),
            zone: 3,
            lng: 14.879525132220152,
            lat: 51.22165543174137,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-3".to_string(),
            zone: 3,
            lng: 14.753736228472121,
            lat: 51.04190085802671,
        }),
    )
    .await;

    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-1".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-2".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-3".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-4".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-5".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-1".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-2".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-3".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-1".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-2".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-3".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-4".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB4-1".to_string(),
            company: 4,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB4-2".to_string(),
            company: 4,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-1".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-2".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-3".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-1".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-2".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-3".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-1".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-2".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-3".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-4".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-1".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-2".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-3".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-4".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-5".to_string(),
            company: 8,
        }),
    )
    .await;

    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 2,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(18, 00, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 5,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(9, 15, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 2,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(15, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 2,
            amount: 1,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(7, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 2,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(12, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(7, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(12, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(16, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 4,
            amount: 2,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(16, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 4,
            amount: 2,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 15, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 5,
            amount: 2,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(13, 15, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 5,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 35, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(7, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(11, 35, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 1,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(17, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 7,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 7,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 5,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(9, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(12, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 3,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(8, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 4,
            interval: be::interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;

    data.insert_event_pair_into_db(
        State(s.clone()),
        &"".to_string(),
        14.225917859910453,
        51.26183078936296,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 20, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        1,
        1,
        1,
        1,
        false,
        false,
        14.324673828581723,
        51.336726303316794,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
    )
    .await;

    let read_capacities = data
        .get_capacity(axum::Json(GetCapacity {
            company: 1,
            time_frame_end: None,
            time_frame_start: None,
        }))
        .await;
    for (key, caps) in read_capacities.iter() {
        for cap in caps.iter() {
            println!("interval found for capacity - get request with company: 1, vehicle specs: 1  and amount: {}:    {}",key,cap);
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    setup_logging()?;
    dotenv().ok();

    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let conn = Database::connect(db_url)
        .await
        .expect("Database connection failed");
    Migrator::up(&conn, None).await.unwrap();

    let livereload = LiveReloadLayer::new();
    let reloader = livereload.reloader();

    let tera = match Tera::new("html/*.html") {
        Ok(t) => Arc::new(Mutex::new(t)),
        Err(e) => {
            println!("Parsing error(s): {}", e);
            ::std::process::exit(1);
        }
    };
    let watcher_tera = tera.clone();
    let mut watcher = notify::recommended_watcher(move |_| {
        let mut tera = watcher_tera.lock().unwrap();
        match tera.full_reload() {
            Ok(_) => println!(
                "Template reload successful: {}",
                tera.get_template_names().join(", ")
            ),
            Err(e) => println!("Error reloading templates: {e:?}"),
        }
        reloader.reload();
        println!("Reload!");
    })?;
    watcher.watch(
        Path::new("./output.css"),
        notify::RecursiveMode::NonRecursive,
    )?;

    let s = AppState {
        tera: tera,
        db: Arc::new(conn),
    };
    init(State(s.clone())).await;

    let app = Router::new();
    let app = app.route("/calendar", get(calendar).with_state(s.clone()));
    let app = app.route("/register", get(register).with_state(s.clone()));
    let app = app.route("/users", get(users).with_state(s.clone()));
    let app = app.route_service("/output.css", ServeFile::new("output.css"));
    let app = app.layer(livereload);
    let app = app.layer(CompressionLayer::new());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3030").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
