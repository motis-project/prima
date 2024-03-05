use crate::entities::prelude::User;

use crate::district_geojson::{bautzen_split_1::BAUTZEN1,bautzen_split_2::BAUTZEN2, gorlitz::GORLITZ};
use crate::be::backend::Data;

use chrono::NaiveDate;
use axum::{
    extract::State,
    http::{StatusCode, Uri},
    response::Html,
    routing::get,
    Router,
};
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


mod entities;
mod log;
mod osrm;
mod be;
mod district_geojson;

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

async fn insert_user(){
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

async fn init(){
    let mut data = Data::new();

    insert_user().await;

    data.insert_zone(BAUTZEN1, "Bautzen Ost").await;
    data.insert_zone(BAUTZEN2, "Bautzen West").await;
    data.insert_zone(GORLITZ, "Görlitz").await;

    data.insert_vehicle_specifics(3,0,0).await;

    data.insert_company(13.895983751721786,51.220826461859644,"Taxi-Unternehmen Bautzen-1",2).await;
    data.insert_company(14.034681384488607,51.31633774366952,"Taxi-Unternehmen Bautzen-2",2).await;
    data.insert_company(14.179674338162073,51.46704814415014,"Taxi-Unternehmen Bautzen-3",2).await;
    data.insert_company(14.244972698642613,51.27251252133357,"Taxi-Unternehmen Bautzen-4",1).await;
    data.insert_company(14.381821307922678,51.169106961190806,"Taxi-Unternehmen Bautzen-5",1).await;
    data.insert_company(14.708969872564097,51.43354047439519,"Taxi-Unternehmen Görtitz-1",3).await;
    data.insert_company(14.879525132220152,51.22165543174137,"Taxi-Unternehmen Görlitz-2",3).await;
    data.insert_company(14.753736228472121,51.04190085802671,"Taxi-Unternehmen Görlitz-3",3).await;

    data.insert_vehicle(1, "TUB1-1", 3, 0, 0).await;
    data.insert_vehicle(1, "TUB1-2", 3, 0, 0).await;
    data.insert_vehicle(1, "TUB1-3", 3, 0, 0).await;
    data.insert_vehicle(1, "TUB1-4", 3, 0, 0).await;
    data.insert_vehicle(1, "TUB1-5", 3, 0, 0).await;
    data.insert_vehicle(2, "TUB2-1", 3, 0, 0).await;
    data.insert_vehicle(2, "TUB2-2", 3, 0, 0).await;
    data.insert_vehicle(2, "TUB2-3", 3, 0, 0).await;
    data.insert_vehicle(3, "TUB3-1", 3, 0, 0).await;
    data.insert_vehicle(3, "TUB3-2", 3, 0, 0).await;
    data.insert_vehicle(3, "TUB3-3", 3, 0, 0).await;
    data.insert_vehicle(3, "TUB3-4", 3, 0, 0).await;
    data.insert_vehicle(4, "TUB4-1", 3, 0, 0).await;
    data.insert_vehicle(4, "TUB4-2", 3, 0, 0).await;
    data.insert_vehicle(5, "TUB5-1", 3, 0, 0).await;
    data.insert_vehicle(5, "TUB5-2", 3, 0, 0).await;
    data.insert_vehicle(5, "TUB5-3", 3, 0, 0).await;
    data.insert_vehicle(6, "TUG1-1", 3, 0, 0).await;
    data.insert_vehicle(6, "TUG1-2", 3, 0, 0).await;
    data.insert_vehicle(6, "TUG1-3", 3, 0, 0).await;
    data.insert_vehicle(7, "TUG2-1", 3, 0, 0).await;
    data.insert_vehicle(7, "TUG2-2", 3, 0, 0).await;
    data.insert_vehicle(7, "TUG2-3", 3, 0, 0).await;
    data.insert_vehicle(7, "TUG2-4", 3, 0, 0).await;
    data.insert_vehicle(8, "TUG3-1", 3, 0, 0).await;
    data.insert_vehicle(8, "TUG3-2", 3, 0, 0).await;
    data.insert_vehicle(8, "TUG3-3", 3, 0, 0).await;
    data.insert_vehicle(8, "TUG3-4", 3, 0, 0).await;
    data.insert_vehicle(8, "TUG3-5", 3, 0, 0).await;

    data.insert_capacity(1, 4, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 10, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(14, 30, 0).unwrap()).await;
    data.insert_capacity(1, 2, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(16, 0, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(18, 00, 0).unwrap()).await;
    data.insert_capacity(1, 5, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(9, 10, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(14, 30, 0).unwrap()).await;
    data.insert_capacity(2, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 10, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(15, 30, 0).unwrap()).await;
    data.insert_capacity(2, 1, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(7, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(11, 30, 0).unwrap()).await;
    data.insert_capacity(3, 2, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(8, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(12, 30, 0).unwrap()).await;
    data.insert_capacity(3, 4, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(7, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(12, 00, 0).unwrap()).await;
    data.insert_capacity(3, 4, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(11, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(16, 30, 0).unwrap()).await;
    data.insert_capacity(4, 2, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(8, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(16, 30, 0).unwrap()).await;
    data.insert_capacity(4, 2, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(10, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(15, 15, 0).unwrap()).await;
    data.insert_capacity(5, 2, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(8, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(13, 15, 0).unwrap()).await;
    data.insert_capacity(5, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(11, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(14, 35, 0).unwrap()).await;
    data.insert_capacity(6, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(7, 30, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(11, 35, 0).unwrap()).await;
    data.insert_capacity(6, 1, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(13, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(17, 0, 0).unwrap()).await;
    data.insert_capacity(6, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(11, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(15, 0, 0).unwrap()).await;
    data.insert_capacity(7, 4, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 00, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(15, 0, 0).unwrap()).await;
    data.insert_capacity(7, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(10, 30, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(13, 0, 0).unwrap()).await;
    data.insert_capacity(8, 5, 1, NaiveDate::from_ymd_opt(2024, 4, 14).unwrap().and_hms_opt(9, 30, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(12, 30, 0).unwrap()).await;
    data.insert_capacity(8, 3, 1, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(8, 30, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(13, 0, 0).unwrap()).await;
    data.insert_capacity(8, 4, 1, NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(10, 30, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 16).unwrap().and_hms_opt(15, 0, 0).unwrap()).await;

    data.insert_event_pair(14.225917859910453, 51.26183078936296, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 20, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 10, 0).unwrap(), 1, None, 1, 1, 2, 0, 0, false,
    14.324673828581723, 51.336726303316794, NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(10, 0, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(10, 10, 0).unwrap(), false).await;
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

    init().await;

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
