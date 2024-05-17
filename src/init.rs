use std::env;

use crate::{
    backend::{
        data::Data,
        id_types::{CompanyIdT, IdT, UserIdT, VehicleIdT, ZoneIdT},
        lib::PrimaData,
    },
    constants::{bautzen_ost::BAUTZEN_OST, bautzen_west::BAUTZEN_WEST, gorlitz::GORLITZ},
    entities::{
        address, availability, company, event, prelude::User, request, tour, user, vehicle, zone,
    },
    error,
};
use chrono::NaiveDate;

use axum::extract::State;
use chrono::{Datelike, Duration, Local, NaiveTime, Timelike, Utc};
use migration::{ConnectionTrait, Migrator, MigratorTrait};
use sea_orm::{Database, DbConn, EntityTrait};
use std::{
    ops::Deref,
    sync::{Arc, Mutex},
};
use tokio::sync::RwLock;

pub enum InitType {
    BackendTest,
    BackendTestWithEvents,
    FrontEnd,
    Standard,
}

pub async fn clear(db_conn: &DbConn) {
    match event::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE event_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match address::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE address_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match request::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE request_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match tour::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE tour_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match availability::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE availability_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match vehicle::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE vehicle_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match user::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE user_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match company::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE company_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match zone::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE zone_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    println!("clear succesful");
}

pub async fn init(
    clear_tables: bool,
    t: InitType,
) -> Data {
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let db_conn = &Database::connect(db_url)
        .await
        .expect("Database connection failed");
    Migrator::up(db_conn, None).await.unwrap();
    if clear_tables {
        clear(db_conn).await;
    }
    if let Ok(u) = User::find().all(db_conn).await {
        if !u.is_empty() {
            println!("users already exist, not running init() again.");
            let mut data = Data::new(db_conn);
            data.read_data_from_db().await;
            return data;
        }
    }
    let next_year = Utc::now().year() + 1;
    match t {
        InitType::Standard => init_default(db_conn, next_year).await,
        InitType::FrontEnd => init_frontend(db_conn, next_year).await,
        InitType::BackendTest => init_backend_test(db_conn, 5000).await,
        InitType::BackendTestWithEvents => init_backend_test_with_events(db_conn, 5000).await,
    }
}

async fn init_frontend(
    db_conn: &DbConn,
    _year: i32,
) -> Data {
    Data::new(db_conn)
}

async fn init_backend_test(
    db_conn: &DbConn,
    year: i32,
) -> Data {
    let mut data = Data::new(db_conn);

    data.create_zone("Bautzen Ost", BAUTZEN_OST).await;
    data.create_zone("Bautzen West", BAUTZEN_WEST).await;
    data.create_zone("Görlitz", GORLITZ).await;

    data.create_company(
        "Taxi-Unternehmen Bautzen-1",
        ZoneIdT::new(1),
        "a@b",
        51.203935,
        13.941692,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-2",
        ZoneIdT::new(1),
        "b@c",
        51.31332,
        14.030458,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-1",
        ZoneIdT::new(2),
        "c@d",
        51.27332,
        14.031458,
    )
    .await;

    data.create_user(
        "TestDriver1",
        true,
        false,
        Some(CompanyIdT::new(1)),
        false,
        "test@aol.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        "TestUser1",
        false,
        false,
        None,
        false,
        "test@web.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_vehicle("TUB1-1", CompanyIdT::new(1)).await;
    data.create_vehicle("TUB1-2", CompanyIdT::new(1)).await;
    data.create_vehicle("TUB2-1", CompanyIdT::new(2)).await;
    data.create_vehicle("TUB2-2", CompanyIdT::new(2)).await;
    data.create_vehicle("TUG1-1", CompanyIdT::new(3)).await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(1),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(2),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(3),
    )
    .await;

    data
}

async fn init_backend_test_with_events(
    db_conn: &DbConn,
    year: i32,
) -> Data {
    let mut data = Data::new(db_conn);

    data.create_zone("Bautzen Ost", BAUTZEN_OST).await;
    data.create_zone("Bautzen West", BAUTZEN_WEST).await;
    data.create_zone("Görlitz", GORLITZ).await;

    data.create_company(
        "Taxi-Unternehmen Bautzen-1",
        ZoneIdT::new(1),
        "a@b",
        51.203935,
        13.941692,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-2",
        ZoneIdT::new(1),
        "b@c",
        51.31332,
        14.030458,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-1",
        ZoneIdT::new(2),
        "c@d",
        51.27332,
        14.031458,
    )
    .await;

    data.create_user(
        "TestDriver1",
        true,
        false,
        Some(CompanyIdT::new(1)),
        false,
        "test@aol.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        "TestUser1",
        false,
        false,
        None,
        false,
        "test@web.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_vehicle("TUB1-1", CompanyIdT::new(1)).await;
    data.create_vehicle("TUB1-2", CompanyIdT::new(1)).await;
    data.create_vehicle("TUB2-1", CompanyIdT::new(2)).await;
    data.create_vehicle("TUB2-2", CompanyIdT::new(2)).await;
    data.create_vehicle("TUG1-1", CompanyIdT::new(3)).await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(1),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(2),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(3),
    )
    .await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(11, 00, 0)
            .unwrap(),
        VehicleIdT::new(1),
        "start_address",
        "target_address",
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 15, 0)
            .unwrap(),
        UserIdT::new(1),
        1,
        0,
        0,
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 50, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 50, 0)
            .unwrap(),
    )
    .await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(12, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(13, 0, 0)
            .unwrap(),
        VehicleIdT::new(2),
        "start_address",
        "target_address",
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(12, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(12, 15, 0)
            .unwrap(),
        UserIdT::new(1),
        1,
        0,
        0,
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(13, 5, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(13, 5, 0)
            .unwrap(),
    )
    .await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        VehicleIdT::new(1),
        "start_address",
        "target_address",
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        UserIdT::new(2),
        1,
        0,
        0,
        51.203935,
        13.941692,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 50, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 50, 0)
            .unwrap(),
    )
    .await;

    data
}

async fn init_default(
    db_conn: &DbConn,
    year: i32,
) -> Data {
    let mut data = Data::new(db_conn);

    data.create_zone("Bautzen Ost", BAUTZEN_OST).await;
    data.create_zone("Bautzen West", BAUTZEN_WEST).await;
    data.create_zone("Görlitz", GORLITZ).await;

    data.create_company(
        "Taxi-Unternehmen Bautzen-1",
        ZoneIdT::new(2),
        "a@b",
        51.179940,
        14.000301,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-2",
        ZoneIdT::new(2),
        "b@c",
        14.034681,
        51.316338,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-3",
        ZoneIdT::new(2),
        "c@d",
        14.179674,
        51.46705,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-4",
        ZoneIdT::new(1),
        "d@e",
        14.244972,
        51.27251,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-5",
        ZoneIdT::new(1),
        "e@f",
        14.381821,
        51.169107,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-1",
        ZoneIdT::new(3),
        "f@g",
        14.70897,
        51.43354,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-2",
        ZoneIdT::new(3),
        "g@h",
        14.879525,
        51.221655,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-3",
        ZoneIdT::new(3),
        "h@i",
        14.7537362,
        51.0419,
    )
    .await;

    data.create_user(
        "TestDriver1",
        true,
        false,
        Some(CompanyIdT::new(1)),
        false,
        "test@aol.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        "TestUser1",
        false,
        false,
        None,
        false,
        "test@web.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        "TestUser2",
        false,
        false,
        None,
        false,
        "test@mail.com",
        Some("".to_string()),
        "",
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_vehicle("BZ-TU-11", CompanyIdT::new(1)).await;
    data.create_vehicle("BZ-TU-12", CompanyIdT::new(1)).await;
    data.create_vehicle("BZ-TU-13", CompanyIdT::new(1)).await;
    data.create_vehicle("BZ-TU-14", CompanyIdT::new(1)).await;
    data.create_vehicle("BZ-TU-15", CompanyIdT::new(1)).await;
    data.create_vehicle("TUB2-1", CompanyIdT::new(2)).await;
    data.create_vehicle("TUB2-2", CompanyIdT::new(2)).await;
    data.create_vehicle("TUB2-3", CompanyIdT::new(2)).await;
    data.create_vehicle("TUB3-1", CompanyIdT::new(3)).await;
    data.create_vehicle("TUB3-2", CompanyIdT::new(3)).await;
    data.create_vehicle("TUB3-3", CompanyIdT::new(3)).await;
    data.create_vehicle("TUB3-4", CompanyIdT::new(3)).await;
    data.create_vehicle("TUB4-1", CompanyIdT::new(4)).await;
    data.create_vehicle("TUB4-2", CompanyIdT::new(4)).await;
    data.create_vehicle("TUB5-1", CompanyIdT::new(5)).await;
    data.create_vehicle("TUB5-2", CompanyIdT::new(5)).await;
    data.create_vehicle("TUB5-3", CompanyIdT::new(5)).await;
    data.create_vehicle("GR-TU-11", CompanyIdT::new(6)).await;
    data.create_vehicle("GR-TU-12", CompanyIdT::new(6)).await;
    data.create_vehicle("GR-TU-13", CompanyIdT::new(6)).await;
    data.create_vehicle("TUG2-1", CompanyIdT::new(7)).await;
    data.create_vehicle("TUG2-2", CompanyIdT::new(7)).await;
    data.create_vehicle("TUG2-3", CompanyIdT::new(7)).await;
    data.create_vehicle("TUG2-4", CompanyIdT::new(7)).await;
    data.create_vehicle("TUG3-1", CompanyIdT::new(8)).await;
    data.create_vehicle("TUG3-2", CompanyIdT::new(8)).await;
    data.create_vehicle("TUG3-3", CompanyIdT::new(8)).await;
    data.create_vehicle("TUG3-4", CompanyIdT::new(8)).await;
    data.create_vehicle("TUG3-5", CompanyIdT::new(8)).await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap(),
        VehicleIdT::new(1),
        "karolinenplatz 5",
        "Lichtwiesenweg 3",
        13.867512,
        51.22069,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 12, 0)
            .unwrap(),
        UserIdT::new(2),
        3,
        0,
        0,
        14.025081,
        51.195075,
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 55, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 18, 0)
            .unwrap(),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        VehicleIdT::new(1),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 35, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(9, 32, 0)
            .unwrap(),
        VehicleIdT::new(2),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        VehicleIdT::new(3),
    )
    .await;

    data
}
