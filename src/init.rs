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
};
use axum::extract::State;
use chrono::NaiveDate;
use migration::{ConnectionTrait, Migrator, MigratorTrait};
use sea_orm::{Database, DbConn, EntityTrait};
use std::{
    env,
    sync::{Arc, Mutex},
};
use tera::{Context, Tera};

#[derive(Clone)]
pub struct AppState {
    tera: Arc<Mutex<Tera>>,
    db: Arc<DbConn>,
    data: Arc<Data>,
}

impl AppState {
    pub fn render(
        &self,
        template_name: &str,
        context: &Context,
    ) -> Result<String, tera::Error> {
        self.tera.lock().unwrap().render(template_name, context)
    }

    pub fn db(&self) -> &DbConn {
        &*self.db
    }

    pub fn data(&self) -> &Data {
        &*self.data
    }
}

#[derive(PartialEq)]
pub enum StopFor {
    TEST1,
}

async fn clear(db: &DbConn) {
    match event::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE event_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match assignment::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE assignment_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match availability::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE availability_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match vehicle::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE vehicle_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match company::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE company_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match zone::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE zone_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match vehicle_specifics::Entity::delete_many().exec(db).await {
        Ok(_) => match db
            .execute_unprepared("ALTER SEQUENCE vehicle_specifics_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        },
        Err(e) => error!("{}", e),
    }
    match user::Entity::delete_many().exec(db).await {
        Ok(_) => match db
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
    tera: Arc<Mutex<Tera>>,
    clear_tables: bool,
    stop_for_tests: StopFor,
) -> AppState {
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let conn = Database::connect(db_url)
        .await
        .expect("Database connection failed");
    Migrator::up(&conn, None).await.unwrap();

    let db = conn;
    let mut data = Data::new();

    if clear_tables {
        clear(&db).await;
    } else {
        match User::find().all(&db).await {
            Ok(u) => {
                if !u.is_empty() {
                    println!("users already exist, not running init() again.");
                    data.read_data_from_db(&db).await;
                    return AppState {
                        tera: tera,
                        db: Arc::new(db),
                        data: Arc::new(data),
                    };
                }
            }
            Err(_) => (),
        }
    }

    data.create_user(
        // State(&s),
        &db,
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
        // State(&s),
        &db,
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
        // State(&s),
        &db,
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
        // State(&s),
        &db,
        "Bautzen Ost".to_string(),
        BAUTZEN_OST.to_string(),
    )
    .await;
    data.create_zone(
        // State(&s),
        &db,
        "Bautzen West".to_string(),
        BAUTZEN_WEST.to_string(),
    )
    .await;
    data.create_zone(
        // State(&s),
        &db,
        "Görlitz".to_string(),
        GORLITZ.to_string(),
    )
    .await;

    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Bautzen-1".to_string(),
        2,
        13.895983751721786,
        51.220826461859644,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Bautzen-2".to_string(),
        2,
        14.034681384488607,
        51.31633774366952,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Bautzen-3".to_string(),
        2,
        14.179674338162073,
        51.46704814415014,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Bautzen-4".to_string(),
        1,
        14.244972698642613,
        51.27251252133357,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Bautzen-5".to_string(),
        1,
        14.381821307922678,
        51.169106961190806,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Görlitz-1".to_string(),
        3,
        14.708969872564097,
        51.43354047439519,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Görlitz-2".to_string(),
        3,
        14.879525132220152,
        51.22165543174137,
    )
    .await;
    data.create_company(
        // State(&s),
        &db,
        "Taxi-Unternehmen Görlitz-3".to_string(),
        3,
        14.753736228472121,
        51.04190085802671,
    )
    .await;

    data.create_vehicle(
        // State(&s),
        &db,
        "TUB1-1".to_string(),
        1,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB1-2".to_string(),
        1,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB1-3".to_string(),
        1,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB1-4".to_string(),
        1,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB1-5".to_string(),
        1,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB2-1".to_string(),
        2,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB2-2".to_string(),
        2,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB2-3".to_string(),
        2,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB3-1".to_string(),
        3,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB3-2".to_string(),
        3,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB3-3".to_string(),
        3,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB3-4".to_string(),
        3,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB4-1".to_string(),
        4,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB4-2".to_string(),
        4,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB5-1".to_string(),
        5,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB5-2".to_string(),
        5,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUB5-3".to_string(),
        5,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG1-1".to_string(),
        6,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG1-2".to_string(),
        6,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG1-3".to_string(),
        6,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG2-1".to_string(),
        7,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG2-2".to_string(),
        7,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG2-3".to_string(),
        7,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG2-4".to_string(),
        7,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG3-1".to_string(),
        8,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG3-2".to_string(),
        8,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG3-3".to_string(),
        8,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG3-4".to_string(),
        8,
    )
    .await;
    data.create_vehicle(
        // State(&s),
        &db,
        "TUG3-5".to_string(),
        8,
    )
    .await;

    data.insert_or_add_assignment(
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
        // State(&s),
        &db,
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

    data.insert_or_add_assignment(
        None,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 30, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 20, 0)
            .unwrap(),
        1,
        // State(&s),
        &db,
        &"karolinenplatz 5".to_string(),
        &"Lichtwiesenweg 3".to_string(),
        13.867512445295205,
        51.22069201951501,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 35, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 32, 0)
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
            .and_hms_opt(10, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
    )
    .await;

    data.insert_or_add_assignment(
        None,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(11, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(12, 0, 0)
            .unwrap(),
        1,
        // State(&s),
        &db,
        &"karolinenplatz 5".to_string(),
        &"Lichtwiesenweg 3".to_string(),
        13.867512445295205,
        51.22069201951501,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(11, 15, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(11, 12, 0)
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
            .and_hms_opt(11, 55, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(11, 18, 0)
            .unwrap(),
    )
    .await;

    data.create_availability(
        // State(&s),
        &db,
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
        // State(&s),
        &db,
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
        // State(&s),
        &db,
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

    data.change_vehicle_for_assignment(
        // State(&s),
        &db, 1, 2,
    )
    .await;

    let test_points = TestPoints::new();
    let p_in_bautzen_ost = test_points.bautzen_ost[0];
    let p_in_bautzen_west = test_points.bautzen_west[0];

    if stop_for_tests == TEST1 {
        return AppState {
            tera: tera,
            db: Arc::new(db),
            data: Arc::new(data),
        };
    }
    data.handle_routing_request(
        // State(&s),
        &db,
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

    AppState {
        tera: tera,
        db: Arc::new(db),
        data: Arc::new(data),
    }
}
