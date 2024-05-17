use axum::{
    routing::{get, post},
    Router,
};
use backend::lib::PrimaData;
use dotenv::dotenv;
use itertools::Itertools;
use log::setup_logging;
use notify::Watcher;
use std::{
    path::Path,
    sync::{Arc, Mutex},
};
use tera::{Context, Tera};
use tokio::sync::RwLock;
use tower_http::{compression::CompressionLayer, services::ServeFile};
use tower_livereload::LiveReloadLayer;
use tracing::error;

use view::{
    availability::{
        add_vehicle_availability, create_vehicle, get_availability, render_add_vehicle,
        render_availability,
    },
    tours::{create_request, get_tour_details, get_tours},
    users::{render_login, render_register},
};

use view::users::{create_user, delete_user, login_user, logout_user, update_user, users};

mod backend;
mod constants;
mod entities;
mod init;
mod log;
mod osrm;
mod view;

#[derive(Clone)]
pub struct AppState {
    tera: Arc<Mutex<Tera>>,
    pub data: Arc<RwLock<dyn PrimaData>>,
}

impl AppState {
    fn render(
        &self,
        template_name: &str,
        context: &Context,
    ) -> Result<String, tera::Error> {
        self.tera.lock().unwrap().render(template_name, context)
    }
}

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

    // let data = init::init(false, init::InitType::Standard).await;
    let data = init::init(true, init::InitType::Standard).await;

    let s = AppState {
        tera,
        data: Arc::new(RwLock::new(data)),
    };

    let app = Router::new();
    let app = app.layer(livereload);
    let app = app.layer(CompressionLayer::new());

    // CRUD user
    let app = app.route("/register", get(render_register).with_state(s.clone()));
    let app = app.route("/register", post(create_user).with_state(s.clone()));
    let app = app.route("/login", get(render_login).with_state(s.clone()));
    let app = app.route("/login", post(login_user).with_state(s.clone()));
    let app = app.route("/logout", post(logout_user).with_state(s.clone()));
    let app = app.route("/users", get(users).with_state(s.clone()));
    let app = app.route("/update", post(update_user).with_state(s.clone()));
    let app = app.route("/delete", post(delete_user).with_state(s.clone()));

    // add vehicle view
    let app = app.route("/vehicle", get(render_add_vehicle).with_state(s.clone()));
    let app = app.route("/vehicle", post(create_vehicle).with_state(s.clone()));

    // vehicle availability view
    let app = app.route(
        "/availability",
        get(render_availability).with_state(s.clone()),
    );
    let app = app.route(
        "/availability",
        post(add_vehicle_availability).with_state(s.clone()),
    );
    let app = app.route(
        "/vehicle_availability",
        get(get_availability).with_state(s.clone()),
    );
    let app = app.route("/vehicle_tours", get(get_tours).with_state(s.clone()));

    // route details view
    let app = app.route("/tour_details", get(get_tour_details).with_state(s.clone()));

    // TEST routing reuquest
    let app = app.route(
        "/routing_request",
        post(create_request).with_state(s.clone()),
    );

    // static files
    let app = app.route_service("/output.css", ServeFile::new("output.css"));
    let app = app.route_service(
        "/static/js/availability.js",
        ServeFile::new("static/js/availability.js"),
    );
    let app = app.route_service("/static/js/style.js", ServeFile::new("static/js/style.js"));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3030").await?;
    axum::serve(listener, app).await?;

    Ok(())
}
