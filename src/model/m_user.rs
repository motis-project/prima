use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::{Html, Redirect},
    Form,
};

use sea_orm::{ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Deserialize;
use serde_json::json;
use tera::Context;
use tracing::{error, info};

use crate::{
    entities::{prelude::User, user},
    AppState,
};

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

pub async fn create_user(
    State(s): State<AppState>,
    Form(sign_up): Form<SignUpForm>,
) -> Redirect {
    // let user = User::find()
    //     .filter(user::Column::Name.eq(&sign_up.username))
    //     .filter(user::Column::Email.eq(&sign_up.email))
    //     .one(s.db())
    //     .await
    //     .unwrap_or(None);

    let mut redirect_url = "/register";
    // match user {
    //     Some(user) => {
    //         println!("User: {} already exists.", user.name);
    //     }
    //     None => {
    //         let result = User::insert(user::ActiveModel {
    //             id: ActiveValue::NotSet,
    //             name: ActiveValue::Set(sign_up.username.to_string()),
    //             email: ActiveValue::Set(sign_up.email.to_string()),

    //             is_driver: ActiveValue::Set(true),
    //             is_admin: ActiveValue::Set(false),

    //             password: ActiveValue::Set(Some(sign_up.password.to_string())),
    //             salt: ActiveValue::Set("".to_string()),
    //             o_auth_id: ActiveValue::Set(Some("".to_string())),
    //             o_auth_provider: ActiveValue::Set(Some("".to_string())),
    //             is_active: ActiveValue::Set(true),
    //         })
    //         .exec(s.db())
    //         .await;

    //         match result {
    //             Ok(_) => {
    //                 info!("User created.");
    //                 redirect_url = "/login";
    //             }
    //             Err(e) => error!("Error adding user: {e:?}"),
    //         }
    //     }
    // }

    Redirect::to(redirect_url)
}

pub async fn login_user(
    State(s): State<AppState>,
    Form(login): Form<LoginUserForm>,
) -> Redirect {
    // let user = User::find()
    //     .filter(user::Column::Name.eq(login.username))
    //     .filter(user::Column::Password.eq(login.password))
    //     .filter(user::Column::IsActive.eq(true))
    //     .one(s.db())
    //     .await
    //     .unwrap_or(None);

    let mut redirect_url = "/login";
    // match user {
    //     Some(user) => {
    //         println!("User: {} just logged in.", user.name);
    //         redirect_url = "/users";
    //     }
    //     None => println!("User not found"),
    // }

    Redirect::to(redirect_url)
}

pub async fn logout_user(
    State(s): State<AppState>,
    Json(payload): Json<LoginUserForm>,
) -> Redirect {
    // let user = User::find()
    //     .filter(user::Column::Name.eq(payload.username))
    //     .one(s.db())
    //     .await
    //     .unwrap_or(None);

    let mut redirect_url = "/login";
    // match user {
    //     Some(user) => {
    //         println!("User: {} just logged out.", user.name);
    //     }
    //     None => {
    //         println!("Logout failed. User not found");
    //         redirect_url = "/";
    //     }
    // }

    Redirect::to(redirect_url)
}

pub async fn deactivate_user(
    State(s): State<AppState>,
    Json(payload): Json<DeleteUserForm>,
) -> Result<Html<String>, StatusCode> {
    // let user = User::find_by_id(1)
    //     .one(s.db())
    //     .await
    //     .map_err(|e| {
    //         error!("Database error: {e:?}");
    //         StatusCode::INTERNAL_SERVER_ERROR
    //     })?
    //     .ok_or(StatusCode::NOT_FOUND)?;

    // let mut user: user::ActiveModel = user.into();

    // user.is_active = Set(false);

    // let _ = user.update(s.db()).await;

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
    // let user = User::find_by_id(payload.id)
    //     .one(s.db())
    //     .await
    //     .map_err(|e| {
    //         error!("Database error: {e:?}");
    //         StatusCode::INTERNAL_SERVER_ERROR
    //     })?
    //     .ok_or(StatusCode::NOT_FOUND)?;

    // let user: user::ActiveModel = user.into();
    // let _ = user.delete(s.db()).await;

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
    // let user = User::find_by_id(1)
    //     .one(s.db())
    //     .await
    //     .map_err(|e| {
    //         error!("Database error: {e:?}");
    //         StatusCode::INTERNAL_SERVER_ERROR
    //     })?
    //     .ok_or(StatusCode::NOT_FOUND)?;

    // // let username = user.name.to_owned();
    let username = "";

    // let mut user: user::ActiveModel = user.into();
    // user.password = Set(Some("newpwd".to_string()));
    // let _ = user.update(s.db()).await;

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
