use crate::init::StopFor::TEST1;
use axum::{
    extract::State,
    routing::{get, post},
    Router,
};

use backend::data::Data;
use dotenv::dotenv;

use itertools::Itertools;
use log::setup_logging;
use migration::{Migrator, MigratorTrait};
use notify::Watcher;
use sea_orm::{Database, DbConn};
use std::{
    env,
    path::Path,
    sync::{Arc, Mutex},
};
use tera::{Context, Tera};
use tower_http::{compression::CompressionLayer, services::ServeFile};
use tower_livereload::LiveReloadLayer;
use tracing::error;

use view::render::{
    get_route_details, render_driver_sign_in, render_home, render_login, render_register,
    render_tours,
};

use model::m_user::{
    create_user, delete_user, login_user, logout_user, post_json_test, update_user, users,
};

mod backend;
mod constants;
mod entities;
mod init;
mod log;
mod model;
mod osrm;
mod view;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    setup_logging()?;
    dotenv().ok();

    let livereload = LiveReloadLayer::new();
    let reloader = livereload.reloader();

    let tera = match Tera::new("html/**/*.html") {
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

    let s = init::init(tera, false, TEST1).await;

    let app = Router::new();
    let app = app.layer(livereload);
    let app = app.layer(CompressionLayer::new());

    // GET render and deliver views
    let app = app.route("/register", get(render_register).with_state(s.clone()));
    let app = app.route("/login", get(render_login).with_state(s.clone()));
    let app = app.route("/users", get(users).with_state(s.clone()));
    let app = app.route("/", get(render_home).with_state(s.clone()));
    let app = app.route("/driver", get(render_driver_sign_in).with_state(s.clone()));
    // let app = app.route(
    //     "/tc-dashboard",
    //     get(render_tc_dashboard).with_state(s.clone()),
    // );
    let app = app.route("/tours", get(render_tours).with_state(s.clone()));
    let app = app.route(
        "/routes/:route_id",
        get(get_route_details).with_state(s.clone()),
    );

    // GET static files
    let app = app.route_service("/output.css", ServeFile::new("output.css"));
    let app = app.route_service("/static/js/main.js", ServeFile::new("static/js/main.js"));

    // POST json / form data
    let app = app.route("/test", post(post_json_test));
    let app = app.route("/register", post(create_user).with_state(s.clone()));
    let app = app.route("/login", post(login_user).with_state(s.clone()));
    let app = app.route("/logout", post(logout_user).with_state(s.clone()));
    let app = app.route("/update", post(update_user).with_state(s.clone()));
    let app = app.route("/delete", post(delete_user).with_state(s.clone()));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3030").await?;
    axum::serve(listener, app).await?;

    Ok(())
}
