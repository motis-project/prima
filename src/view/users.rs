use crate::AppState;
use hyper::Uri;
use tera::Context;

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::{Html, Redirect},
    Form,
};

use serde::Deserialize;
use serde_json::json;
use tracing::error;

#[derive(Deserialize)]
pub struct SignUpForm {
    //id: i32,
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
pub struct LoginUserForm {
    // id: i32,
    username: String,
    password: String,
}

#[derive(Deserialize)]
pub struct DeleteUserForm {
    id: i32,
    username: String,
    password: String,
}

pub async fn render_register(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/register.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn render_login(
    _uri: Uri,
    State(s): State<AppState>,
) -> Result<Html<String>, StatusCode> {
    s.render("taxi-center/login.html", &Context::new())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
        .map(|x| Html(x))
}

pub async fn create_user(
    State(s): State<AppState>,
    Form(sign_up): Form<SignUpForm>,
) -> Redirect {
    let mut redirect_url = "/register";
    Redirect::to(redirect_url)
}

pub async fn login_user(
    State(s): State<AppState>,
    Form(login): Form<LoginUserForm>,
) -> Redirect {
    let mut redirect_url = "/login";
    Redirect::to(redirect_url)
}

pub async fn logout_user(
    State(s): State<AppState>,
    Json(payload): Json<LoginUserForm>,
) -> Redirect {
    let mut redirect_url = "/login";
    Redirect::to(redirect_url)
}

pub async fn deactivate_user(
    State(s): State<AppState>,
    Json(payload): Json<DeleteUserForm>,
) -> Result<Html<String>, StatusCode> {
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

pub async fn delete_user(
    State(s): State<AppState>,
    Json(payload): Json<DeleteUserForm>,
) -> Result<Html<String>, StatusCode> {
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

pub async fn update_user(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
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

pub async fn users(State(s): State<AppState>) -> Result<Html<String>, StatusCode> {
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
