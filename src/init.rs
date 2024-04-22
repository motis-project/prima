use crate::{
    backend::{data::Data, lib::PrimaData},
    constants::{bautzen_ost::BAUTZEN_OST, bautzen_west::BAUTZEN_WEST, gorlitz::GORLITZ},
    entities::{
        address, availability, company, event, prelude::User, request, tour, user, vehicle, zone,
    },
    error,
};
use chrono::NaiveDate;
use migration::ConnectionTrait;
use sea_orm::{DbConn, EntityTrait};

pub enum InitType {
    #[allow(dead_code)]
    BackendTest,
    #[allow(dead_code)]
    FrontEnd,
    Default,
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
    db_conn: &DbConn,
    clear_tables: bool,
    year: i32,
    t: InitType,
) -> Data {
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
    match t {
        InitType::Default => init_default(db_conn, year).await,
        InitType::FrontEnd => init_frontend(db_conn, year).await,
        InitType::BackendTest => init_backend_test(db_conn, year).await,
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

    data.create_company("Taxi-Unternehmen Bautzen-1", 1, "a@b", 13.941692, 51.203935)
        .await;
    data.create_company("Taxi-Unternehmen Bautzen-2", 1, "b@c", 14.030458, 51.31332)
        .await;
    data.create_company("Taxi-Unternehmen Görlitz-1", 2, "c@d", 14.031458, 51.27332)
        .await;

    data.create_user(
        "TestDriver1",
        true,
        false,
        Some(1),
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

    data.create_vehicle("TUB1-1", 1).await;
    data.create_vehicle("TUB1-2", 1).await;
    data.create_vehicle("TUB2-1", 2).await;
    data.create_vehicle("TUB2-2", 2).await;
    data.create_vehicle("TUG1-1", 3).await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 19)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        1,
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
        2,
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
        3,
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

    data.create_company("Taxi-Unternehmen Bautzen-1", 2, "a@b", 13.895984, 51.220826)
        .await;
    data.create_company("Taxi-Unternehmen Bautzen-2", 2, "b@c", 14.034681, 51.316338)
        .await;
    data.create_company("Taxi-Unternehmen Bautzen-3", 2, "c@d", 14.179674, 51.46705)
        .await;
    data.create_company("Taxi-Unternehmen Bautzen-4", 1, "d@e", 14.244972, 51.27251)
        .await;
    data.create_company("Taxi-Unternehmen Bautzen-5", 1, "e@f", 14.381821, 51.169107)
        .await;
    data.create_company("Taxi-Unternehmen Görlitz-1", 3, "f@g", 14.70897, 51.43354)
        .await;
    data.create_company("Taxi-Unternehmen Görlitz-2", 3, "g@h", 14.879525, 51.221655)
        .await;
    data.create_company("Taxi-Unternehmen Görlitz-3", 3, "h@i", 14.7537362, 51.0419)
        .await;

    data.create_user(
        "TestDriver1",
        true,
        false,
        Some(1),
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

    data.create_vehicle("TUB1-1", 1).await;
    data.create_vehicle("TUB1-2", 1).await;
    data.create_vehicle("TUB1-3", 1).await;
    data.create_vehicle("TUB1-4", 1).await;
    data.create_vehicle("TUB1-5", 1).await;
    data.create_vehicle("TUB2-1", 2).await;
    data.create_vehicle("TUB2-2", 2).await;
    data.create_vehicle("TUB2-3", 2).await;
    data.create_vehicle("TUB3-1", 3).await;
    data.create_vehicle("TUB3-2", 3).await;
    data.create_vehicle("TUB3-3", 3).await;
    data.create_vehicle("TUB3-4", 3).await;
    data.create_vehicle("TUB4-1", 4).await;
    data.create_vehicle("TUB4-2", 4).await;
    data.create_vehicle("TUB5-1", 5).await;
    data.create_vehicle("TUB5-2", 5).await;
    data.create_vehicle("TUB5-3", 5).await;
    data.create_vehicle("TUG1-1", 6).await;
    data.create_vehicle("TUG1-2", 6).await;
    data.create_vehicle("TUG1-3", 6).await;
    data.create_vehicle("TUG2-1", 7).await;
    data.create_vehicle("TUG2-2", 7).await;
    data.create_vehicle("TUG2-3", 7).await;
    data.create_vehicle("TUG2-4", 7).await;
    data.create_vehicle("TUG3-1", 8).await;
    data.create_vehicle("TUG3-2", 8).await;
    data.create_vehicle("TUG3-3", 8).await;
    data.create_vehicle("TUG3-4", 8).await;
    data.create_vehicle("TUG3-5", 8).await;

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
        1,
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
        2,
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
        1,
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
        2,
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
        3,
    )
    .await;
    data
}
