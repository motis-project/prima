use crate::{
    backend::data::Data,
    constants::geo_points::TestPoints,
    constants::{
        bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
    },
    entities::{
        assignment, availability, company, event, prelude::User, user, vehicle, vehicle_specifics,
        zone,
    },
    error,
    init::StopFor::TEST1,
    AppState,
};
use axum::extract::State;
use chrono::NaiveDate;
use migration::ConnectionTrait;
use sea_orm::EntityTrait;

#[derive(PartialEq)]
pub enum StopFor {
    TEST1,
}

async fn clear(State(s): State<&AppState>) {
    match event::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE event_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match assignment::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE assignment_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match availability::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE availability_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match vehicle::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE vehicle_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match company::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE company_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match zone::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE zone_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match vehicle_specifics::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
            .execute_unprepared("ALTER SEQUENCE vehicle_specifics_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match user::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(&s)
            .db()
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
    State(s): State<&AppState>,
    clear_tables: bool,
    stop_for_tests: StopFor,
) -> Data {
    if clear_tables {
        clear(State(&s)).await;
    } else {
        match User::find().all(s.clone().db()).await {
            Ok(u) => {
                if !u.is_empty() {
                    println!("users already exist, not running init() again.");
                    let mut data = Data::new();
                    data.read_data_from_db(State(&s)).await;
                    return data;
                }
            }
            Err(_) => (),
        }
    }
    let mut data = Data::new();

    data.create_user(
        State(&s),
        "TestDriver1".to_string(),
        true,
        false,
        "test@aol.com".to_string(),
        Some("".to_string()),
        "".to_string(),
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        State(&s),
        "TestUser1".to_string(),
        false,
        false,
        "test@web.com".to_string(),
        Some("".to_string()),
        "".to_string(),
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_user(
        State(&s),
        "TestUser2".to_string(),
        false,
        false,
        "test@mail.com".to_string(),
        Some("".to_string()),
        "".to_string(),
        Some("".to_string()),
        Some("".to_string()),
    )
    .await;

    data.create_zone(
        State(&s),
        "Bautzen Ost".to_string(),
        BAUTZEN_OST.to_string(),
    )
    .await;
    data.create_zone(
        State(&s),
        "Bautzen West".to_string(),
        BAUTZEN_WEST.to_string(),
    )
    .await;
    data.create_zone(State(&s), "Görlitz".to_string(), GORLITZ.to_string())
        .await;

    data.create_company(
        State(&s),
        "Taxi-Unternehmen Bautzen-1".to_string(),
        2,
        13.895983751721786,
        51.220826461859644,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Bautzen-2".to_string(),
        2,
        14.034681384488607,
        51.31633774366952,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Bautzen-3".to_string(),
        2,
        14.179674338162073,
        51.46704814415014,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Bautzen-4".to_string(),
        1,
        14.244972698642613,
        51.27251252133357,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Bautzen-5".to_string(),
        1,
        14.381821307922678,
        51.169106961190806,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Görlitz-1".to_string(),
        3,
        14.708969872564097,
        51.43354047439519,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Görlitz-2".to_string(),
        3,
        14.879525132220152,
        51.22165543174137,
    )
    .await;
    data.create_company(
        State(&s),
        "Taxi-Unternehmen Görlitz-3".to_string(),
        3,
        14.753736228472121,
        51.04190085802671,
    )
    .await;

    data.create_vehicle(State(&s), "TUB1-1".to_string(), 1)
        .await;
    data.create_vehicle(State(&s), "TUB1-2".to_string(), 1)
        .await;
    data.create_vehicle(State(&s), "TUB1-3".to_string(), 1)
        .await;
    data.create_vehicle(State(&s), "TUB1-4".to_string(), 1)
        .await;
    data.create_vehicle(State(&s), "TUB1-5".to_string(), 1)
        .await;
    data.create_vehicle(State(&s), "TUB2-1".to_string(), 2)
        .await;
    data.create_vehicle(State(&s), "TUB2-2".to_string(), 2)
        .await;
    data.create_vehicle(State(&s), "TUB2-3".to_string(), 2)
        .await;
    data.create_vehicle(State(&s), "TUB3-1".to_string(), 3)
        .await;
    data.create_vehicle(State(&s), "TUB3-2".to_string(), 3)
        .await;
    data.create_vehicle(State(&s), "TUB3-3".to_string(), 3)
        .await;
    data.create_vehicle(State(&s), "TUB3-4".to_string(), 3)
        .await;
    data.create_vehicle(State(&s), "TUB4-1".to_string(), 4)
        .await;
    data.create_vehicle(State(&s), "TUB4-2".to_string(), 4)
        .await;
    data.create_vehicle(State(&s), "TUB5-1".to_string(), 5)
        .await;
    data.create_vehicle(State(&s), "TUB5-2".to_string(), 5)
        .await;
    data.create_vehicle(State(&s), "TUB5-3".to_string(), 5)
        .await;
    data.create_vehicle(State(&s), "TUG1-1".to_string(), 6)
        .await;
    data.create_vehicle(State(&s), "TUG1-2".to_string(), 6)
        .await;
    data.create_vehicle(State(&s), "TUG1-3".to_string(), 6)
        .await;
    data.create_vehicle(State(&s), "TUG2-1".to_string(), 7)
        .await;
    data.create_vehicle(State(&s), "TUG2-2".to_string(), 7)
        .await;
    data.create_vehicle(State(&s), "TUG2-3".to_string(), 7)
        .await;
    data.create_vehicle(State(&s), "TUG2-4".to_string(), 7)
        .await;
    data.create_vehicle(State(&s), "TUG3-1".to_string(), 8)
        .await;
    data.create_vehicle(State(&s), "TUG3-2".to_string(), 8)
        .await;
    data.create_vehicle(State(&s), "TUG3-3".to_string(), 8)
        .await;
    data.create_vehicle(State(&s), "TUG3-4".to_string(), 8)
        .await;
    data.create_vehicle(State(&s), "TUG3-5".to_string(), 8)
        .await;

    data.insert_or_addto_tour(
        None,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap(),
        1,
        State(&s),
        &"karolinenplatz 5".to_string(),
        &"Lichtwiesenweg 3".to_string(),
        13.867512445295205,
        51.22069201951501,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 12, 0)
            .unwrap(),
        2,
        1,
        1,
        false,
        false,
        14.025081097762154,
        51.195075641827316,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 55, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 18, 0)
            .unwrap(),
    )
    .await;

    data.create_availability(
        State(&s),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        1,
    )
    .await;

    data.create_availability(
        State(&s),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        2,
    )
    .await;

    data.create_availability(
        State(&s),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(14, 0, 0)
            .unwrap(),
        3,
    )
    .await;

    let test_points = TestPoints::new();
    let p_in_bautzen_ost = test_points.bautzen_ost[0];
    let p_in_bautzen_west = test_points.bautzen_west[0];

    if stop_for_tests == TEST1 {
        return data;
    }
    data.handle_routing_request(
        State(&s),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        true,
        p_in_bautzen_ost.0.x,
        p_in_bautzen_ost.0.y,
        p_in_bautzen_west.0.x,
        p_in_bautzen_west.0.y,
        1,
        2,
        &"".to_string(),
        &"".to_string(),
    )
    .await;

    data
}
