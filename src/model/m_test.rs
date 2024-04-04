use crate::{
    backend::data::Data,
    constants::{
        bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
    },
};

use crate::{env, Arc, Database, Mutex, Tera};
use axum::extract::State;
use chrono::NaiveDate;

pub async fn test() {
    let tera = match Tera::new("html/*.html") {
        Ok(t) => Arc::new(Mutex::new(t)),
        Err(e) => {
            println!("Parsing error(s): {}", e);
            ::std::process::exit(1);
        }
    };
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let conn = Database::connect(db_url)
        .await
        .expect("Database connection failed");

    /* let mut data = Data::new();
    let s = AppState {
        tera: tera,
        db: Arc::new(conn),
        data: Arc::new(data),
    };

    data.create_vehicle(
        State(&s),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-6".to_string(),
            company: 1,
        }),
    )
    .await; */
}
