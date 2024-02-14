use crate::entities::prelude::User;
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
