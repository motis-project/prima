use std::{
    net::{Ipv4Addr, SocketAddr},
    sync::Arc,
};

use axum::{
    routing::{get, put},
    Router,
};
use std::io::Error;
use tokio::net::TcpListener;
use utoipa::{
    openapi::security::{ApiKey, ApiKeyValue, SecurityScheme},
    Modify, OpenApi,
};
use utoipa_rapidoc::RapiDoc;

use crate::user::Store;

mod user;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(
        &self,
        openapi: &mut utoipa::openapi::OpenApi,
    ) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "api_key",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("todo_apikey"))),
            )
        }
    }
}

#[derive(OpenApi)]
#[openapi(
    paths(
        todo::list_todos,
        todo::search_todos,
        todo::create_todo,
        todo::mark_done,
        todo::delete_todo,
    ),
    components(
        schemas(user::Todo, user::TodoError)
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "todo", description = "Todo items management API")
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let store = Arc::new(Store::default());
    let app = Router::new()
        .merge(RapiDoc::new("/api-docs/openapi.json").path("/rapidoc"))
        .route("/put", put(user::create))
        .with_state(store);

    let address = SocketAddr::from((Ipv4Addr::UNSPECIFIED, 8080));
    let listener = TcpListener::bind(&address).await?;

    println!("Listening on {address:?}");
    axum::serve(listener, app.into_make_service()).await
}
