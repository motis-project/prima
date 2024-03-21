use axum::{
    extract::{Json, State},
    http::{StatusCode, Uri},
    response::{Html, Redirect},
    routing::{get, post},
    Form, Router,
};
use chrono::NaiveDate;
use dotenv::dotenv;
use entities::{prelude::User, user};
use itertools::Itertools;
use log::setup_logging;
use migration::{Migrator, MigratorTrait};
use notify::Watcher;
use sea_orm::{
    ActiveModelTrait, ActiveValue, ColumnTrait, Database, DbConn, EntityTrait, QueryFilter, Set,
};
use serde::Deserialize;
use serde::Serialize;
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

use view::render::{
    get_route_details, render_driver_sign_in, render_home, render_login, render_register,
    render_tc_dashboard, render_tc_tours,
};

mod be;
mod constants;
mod entities;
mod init;
mod log;
mod osrm;
mod view;

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

#[derive(Deserialize)]
struct SignUpForm {
    //id: i32,
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginUserForm {
    // id: i32,
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct DeleteUserForm {
    id: i32,
    username: String,
    password: String,
}

async fn create_user(
    State(s): State<AppState>,
    Form(sign_up): Form<SignUpForm>,
) -> Redirect {
    let user = User::find()
        .filter(user::Column::Name.eq(&sign_up.username))
        .filter(user::Column::Email.eq(&sign_up.email))
        .one(s.db())
        .await
        .unwrap_or(None);

    let mut redirect_url = "/register";
    match user {
        Some(user) => {
            println!("User: {} already exists.", user.name);
        }
        None => {
            let result = User::insert(user::ActiveModel {
                id: ActiveValue::NotSet,
                name: ActiveValue::Set(sign_up.username.to_string()),
                email: ActiveValue::Set(sign_up.email.to_string()),

                is_driver: ActiveValue::Set(true),
                is_admin: ActiveValue::Set(false),

                password: ActiveValue::Set(Some(sign_up.password.to_string())),
                salt: ActiveValue::Set("".to_string()),
                o_auth_id: ActiveValue::Set(Some("".to_string())),
                o_auth_provider: ActiveValue::Set(Some("".to_string())),
                is_active: ActiveValue::Set(true),
            })
            .exec(s.db())
            .await;

            match result {
                Ok(_) => {
                    info!("User created.");
                    redirect_url = "/login";
                }
                Err(e) => error!("Error adding user: {e:?}"),
            }
        }
    }

    Redirect::to(redirect_url)
}

async fn login_user(
    State(s): State<AppState>,
    Form(login): Form<LoginUserForm>,
) -> Redirect {
    let user = User::find()
        .filter(user::Column::Name.eq(login.username))
        .filter(user::Column::Password.eq(login.password))
        .filter(user::Column::IsActive.eq(true))
        .one(s.db())
        .await
        .unwrap_or(None);

    let mut redirect_url = "/login";
    match user {
        Some(user) => {
            println!("User: {} just logged in.", user.name);
            redirect_url = "/users";
        }
        None => println!("User not found"),
    }

    Redirect::to(redirect_url)
}

async fn logout_user(
    State(s): State<AppState>,
    Json(payload): Json<LoginUserForm>,
) -> Redirect {
    let user = User::find()
        .filter(user::Column::Name.eq(payload.username))
        .one(s.db())
        .await
        .unwrap_or(None);

    let mut redirect_url = "/login";
    match user {
        Some(user) => {
            println!("User: {} just logged out.", user.name);
        }
        None => {
            println!("Logout failed. User not found");
            redirect_url = "/";
        }
    }

    Redirect::to(redirect_url)
}

async fn deactivate_user(
    State(s): State<AppState>,
    Json(payload): Json<DeleteUserForm>,
) -> Result<Html<String>, StatusCode> {
    let user = User::find_by_id(1)
        .one(s.db())
        .await
        .map_err(|e| {
            error!("Database error: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut user: user::ActiveModel = user.into();

    user.is_active = Set(false);

    let _ = user.update(s.db()).await;

    let username = "";
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

async fn delete_user(
    State(s): State<AppState>,
    Json(payload): Json<DeleteUserForm>,
) -> Result<Html<String>, StatusCode> {
    let user = User::find_by_id(payload.id)
        .one(s.db())
        .await
        .map_err(|e| {
            error!("Database error: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let user: user::ActiveModel = user.into();
    let _ = user.delete(s.db()).await;

    let username = "";
    let response = s
        .render(
            "home.html",
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

async fn update_user(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
    let user = User::find_by_id(1)
        .one(s.db())
        .await
        .map_err(|e| {
            error!("Database error: {e:?}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let username = user.name.to_owned();

    let mut user: user::ActiveModel = user.into();
    user.password = Set(Some("newpwd".to_string()));
    let _ = user.update(s.db()).await;

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

// TEST
async fn post_json_test(Json(payload): Json<SignUpForm>) {
    println!("name: {}", payload.username);
    println!("email: {}", payload.email);
    println!("password: {}", payload.password);
}

async fn users(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
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

    let s = AppState {
        tera: tera,
        db: Arc::new(conn),
    };

    init::init(State(s.clone()), false).await;

    let app = Router::new();
    let app = app.layer(livereload);
    let app = app.layer(CompressionLayer::new());

    // GET render and deliver views
    let app = app.route("/register", get(render_register).with_state(s.clone()));
    let app = app.route("/login", get(render_login).with_state(s.clone()));
    let app = app.route("/users", get(users).with_state(s.clone()));
    let app = app.route("/", get(render_home).with_state(s.clone()));
    let app = app.route("/driver", get(render_driver_sign_in).with_state(s.clone()));
    let app = app.route(
        "/tc-dashboard",
        get(render_tc_dashboard).with_state(s.clone()),
    );
    let app = app.route("/tc-tours", get(render_tc_tours).with_state(s.clone()));
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
