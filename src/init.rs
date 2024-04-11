use crate::{
    backend::{data::Data, lib::PrimaData},
    constants::{bautzen_ost::BAUTZEN_OST, bautzen_west::BAUTZEN_WEST, gorlitz::GORLITZ},
    entities::{availability, company, event, prelude::User, tour, user, vehicle, zone},
    error,
};
use chrono::NaiveDate;
use migration::ConnectionTrait;
use sea_orm::{DbConn, EntityTrait};

enum InitType {
    BackendTest,
    FrontEnd,
    Default,
}

async fn clear(db_conn: &DbConn) {
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
    match tour::Entity::delete_many().exec(db_conn).await {
        Ok(_) => match db_conn
            .execute_unprepared("ALTER SEQUENCE tours_id_seq RESTART WITH 1")
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
    println!("clear succesful");
}

pub async fn init(
    db_conn: &DbConn,
    clear_tables: bool,
    year: i32,
) -> Data {
    if clear_tables {
        clear(db_conn).await;
    } else {
        match User::find().all(db_conn).await {
            Ok(u) => {
                if !u.is_empty() {
                    println!("users already exist, not running init() again.");
                    let mut data = Data::new(db_conn);
                    data.read_data_from_db().await;
                    return data;
                }
            }
            Err(_) => (),
        }
    }
    let mut data = Data::new(db_conn);

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

    data.create_zone("Bautzen Ost", BAUTZEN_OST).await;
    data.create_zone("Bautzen West", BAUTZEN_WEST).await;
    data.create_zone("Görlitz", GORLITZ).await;

    data.create_company(
        "Taxi-Unternehmen Bautzen-1",
        2,
        "a@b",
        13.895983751721786,
        51.220826461859644,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-2",
        2,
        "b@c",
        14.034681384488607,
        51.31633774366952,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-3",
        2,
        "c@d",
        14.179674338162073,
        51.46704814415014,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-4",
        1,
        "d@e",
        14.244972698642613,
        51.27251252133357,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Bautzen-5",
        1,
        "e@f",
        14.381821307922678,
        51.169106961190806,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-1",
        3,
        "f@g",
        14.708969872564097,
        51.43354047439519,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-2",
        3,
        "g@h",
        14.879525132220152,
        51.22165543174137,
    )
    .await;
    data.create_company(
        "Taxi-Unternehmen Görlitz-3",
        3,
        "h@i",
        14.753736228472121,
        51.04190085802671,
    )
    .await;

    data.create_vehicle(&"TUB1-1".to_string(), 1).await;
    data.create_vehicle(&"TUB1-2".to_string(), 1).await;
    data.create_vehicle(&"TUB1-3".to_string(), 1).await;
    data.create_vehicle(&"TUB1-4".to_string(), 1).await;
    data.create_vehicle(&"TUB1-5".to_string(), 1).await;
    data.create_vehicle(&"TUB2-1".to_string(), 2).await;
    data.create_vehicle(&"TUB2-2".to_string(), 2).await;
    data.create_vehicle(&"TUB2-3".to_string(), 2).await;
    data.create_vehicle(&"TUB3-1".to_string(), 3).await;
    data.create_vehicle(&"TUB3-2".to_string(), 3).await;
    data.create_vehicle(&"TUB3-3".to_string(), 3).await;
    data.create_vehicle(&"TUB3-4".to_string(), 3).await;
    data.create_vehicle(&"TUB4-1".to_string(), 4).await;
    data.create_vehicle(&"TUB4-2".to_string(), 4).await;
    data.create_vehicle(&"TUB5-1".to_string(), 5).await;
    data.create_vehicle(&"TUB5-2".to_string(), 5).await;
    data.create_vehicle(&"TUB5-3".to_string(), 5).await;
    data.create_vehicle(&"TUG1-1".to_string(), 6).await;
    data.create_vehicle(&"TUG1-2".to_string(), 6).await;
    data.create_vehicle(&"TUG1-3".to_string(), 6).await;
    data.create_vehicle(&"TUG2-1".to_string(), 7).await;
    data.create_vehicle(&"TUG2-2".to_string(), 7).await;
    data.create_vehicle(&"TUG2-3".to_string(), 7).await;
    data.create_vehicle(&"TUG2-4".to_string(), 7).await;
    data.create_vehicle(&"TUG3-1".to_string(), 8).await;
    data.create_vehicle(&"TUG3-2".to_string(), 8).await;
    data.create_vehicle(&"TUG3-3".to_string(), 8).await;
    data.create_vehicle(&"TUG3-4".to_string(), 8).await;
    data.create_vehicle(&"TUG3-5".to_string(), 8).await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap(),
        1,
        &"karolinenplatz 5".to_string(),
        &"Lichtwiesenweg 3".to_string(),
        13.867512445295205,
        51.22069201951501,
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(9, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(9, 12, 0)
            .unwrap(),
        2,
        3,
        0,
        0,
        1,
        false,
        false,
        14.025081097762154,
        51.195075641827316,
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(9, 55, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(9, 18, 0)
            .unwrap(),
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        1,
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        2,
    )
    .await;

    data.create_availability(
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(year, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        3,
    )
    .await;
    data
}
