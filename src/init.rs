use crate::{
    be::backend::{
        CreateCompany, CreateVehicle, CreateVehicleAvailability, CreateZone, Data, UserData,
    },
    constants::{
        bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
    },
    entities::{
        assignment, availability, company, event, prelude::User, user, vehicle, vehicle_specifics,
        zone,
    },
    AppState,
};
use sea_orm::EntityTrait;

use axum::extract::State;
use chrono::NaiveDate;
use migration::ConnectionTrait;

async fn clear(State(s): State<AppState>) {
    match event::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE event_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match assignment::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE assignment_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match availability::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE availability_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match vehicle::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE vehicle_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match company::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE company_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match zone::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE zone_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match vehicle_specifics::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE vehicle_specifics_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    match user::Entity::delete_many().exec(s.db()).await {
        Ok(_) => match State(s.clone())
            .db()
            .execute_unprepared("ALTER SEQUENCE user_id_seq RESTART WITH 1")
            .await
        {
            Ok(_) => (),
            Err(e) => println!("{}", e),
        },
        Err(e) => println!("{}", e),
    }
    println!("clear succesful");
}

pub async fn init(
    State(s): State<AppState>,
    clear_tables: bool,
) {
    if clear_tables {
        clear(State(s.clone())).await;
    } else {
        match User::find().all(s.clone().db()).await {
            Ok(u) => {
                if !u.is_empty() {
                    println!("users already exist, not running init() again.");
                    return;
                }
            }
            Err(_) => (),
        }
    }
    let mut data = Data::new();
    let mut read_from_db_data = Data::new();
    data.create_user(
        State(s.clone()),
        axum::Json(UserData {
            id: None,
            name: "TestDriver1".to_string(),
            is_driver: true,
            is_admin: false,
            email: "".to_string(),
            password: Some("".to_string()),
            salt: "".to_string(),
            o_auth_id: Some("".to_string()),
            o_auth_provider: Some("".to_string()),
        }),
    )
    .await;

    data.create_user(
        State(s.clone()),
        axum::Json(UserData {
            id: None,
            name: "TestUser1".to_string(),
            is_driver: false,
            is_admin: false,
            email: "".to_string(),
            password: Some("".to_string()),
            salt: "".to_string(),
            o_auth_id: Some("".to_string()),
            o_auth_provider: Some("".to_string()),
        }),
    )
    .await;

    data.create_user(
        State(s.clone()),
        axum::Json(UserData {
            id: None,
            name: "TestUser2".to_string(),
            is_driver: false,
            is_admin: false,
            email: "".to_string(),
            password: Some("".to_string()),
            salt: "".to_string(),
            o_auth_id: Some("".to_string()),
            o_auth_provider: Some("".to_string()),
        }),
    )
    .await;

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating user: {}",
        read_from_db_data == data
    );

    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Bautzen Ost".to_string(),
            area: BAUTZEN_OST.to_string(),
        }),
    )
    .await;
    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Bautzen West".to_string(),
            area: BAUTZEN_WEST.to_string(),
        }),
    )
    .await;
    data.create_zone(
        State(s.clone()),
        axum::Json(CreateZone {
            name: "Görlitz".to_string(),
            area: GORLITZ.to_string(),
        }),
    )
    .await;

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating zones: {}",
        read_from_db_data == data
    );

    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-1".to_string(),
            zone: 2,
            lng: 13.895983751721786,
            lat: 51.220826461859644,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-2".to_string(),
            zone: 2,
            lng: 14.034681384488607,
            lat: 51.31633774366952,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-3".to_string(),
            zone: 2,
            lng: 14.179674338162073,
            lat: 51.46704814415014,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-4".to_string(),
            zone: 1,
            lng: 14.244972698642613,
            lat: 51.27251252133357,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Bautzen-5".to_string(),
            zone: 1,
            lng: 14.381821307922678,
            lat: 51.169106961190806,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-1".to_string(),
            zone: 3,
            lng: 14.708969872564097,
            lat: 51.43354047439519,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-2".to_string(),
            zone: 3,
            lng: 14.879525132220152,
            lat: 51.22165543174137,
        }),
    )
    .await;
    data.create_company(
        State(s.clone()),
        axum::Json(CreateCompany {
            name: "Taxi-Unternehmen Görlitz-3".to_string(),
            zone: 3,
            lng: 14.753736228472121,
            lat: 51.04190085802671,
        }),
    )
    .await;

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating companies: {}",
        read_from_db_data == data
    );

    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-1".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-2".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-3".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-4".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB1-5".to_string(),
            company: 1,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-1".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-2".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB2-3".to_string(),
            company: 2,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-1".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-2".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-3".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB3-4".to_string(),
            company: 3,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB4-1".to_string(),
            company: 4,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB4-2".to_string(),
            company: 4,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-1".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-2".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUB5-3".to_string(),
            company: 5,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-1".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-2".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG1-3".to_string(),
            company: 6,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-1".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-2".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-3".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG2-4".to_string(),
            company: 7,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-1".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-2".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-3".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-4".to_string(),
            company: 8,
        }),
    )
    .await;
    data.create_vehicle(
        State(s.clone()),
        axum::Json(CreateVehicle {
            license_plate: "TUG3-5".to_string(),
            company: 8,
        }),
    )
    .await;

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating vehicles: {}",
        read_from_db_data == data
    );

    data.create_availability(
        State(s.clone()),
        axum::Json(CreateVehicleAvailability {
            start_time: (NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap()),
            end_time: (NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap()),
            vehicle: 1,
        }),
    )
    .await;

    data.create_availability(
        State(s.clone()),
        axum::Json(CreateVehicleAvailability {
            start_time: (NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap()),
            end_time: (NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap()),
            vehicle: 1,
        }),
    )
    .await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating availabilities: {}",
        read_from_db_data == data
    );

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating availabilites: {}",
        read_from_db_data == data
    );

    let assignments = data.get_assignments_for_vehicle(1, None, None).await;

    println!("assignments size: {}", assignments.len());
    for assignment in assignments.iter() {
        println!("id: {}", assignment.id);
    }

    for i in 1..9 {
        print_vehicles_of_company(&data, i);
    }

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
        1,
        State(s.clone()),
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
        1,
        State(s.clone()),
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
            .and_hms_opt(10, 10, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(11, 0, 0)
            .unwrap(),
        1,
        1,
        State(s.clone()),
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

    read_from_db_data.clear();
    read_from_db_data.read_data(State(s.clone())).await;
    println!(
        "=_=_=__=__=_=_=_=_=_==_=_=_==_=====_=_=_=_=_==___________________________________________________________________________________________________is data synchronized after creating assignment: {}",
        read_from_db_data == data
    );

    /*
    println!(
        "number of assignments for vehicle 1: {} and number of the first assignments events: {}, departure: {}, arrival: {}, company: {}, vehicle: {}, id: {}",
        data.vehicles[0].assignments.len(),
        data.vehicles[0].assignments[0].events.len(),
        data.vehicles[0].assignments[0].departure,
        data.vehicles[0].assignments[0].arrival,
        data.vehicles[0].assignments[0].company,
        data.vehicles[0].assignments[0].vehicle,
        data.vehicles[0].assignments[0].id
    );
    println!(
        "event1: assginment:{},communicated_time:{},scheduled_time:{},x:{},y:{},company:{},id:{},customer:{},is_pickup:{},request_id:{},required_specs:{}",
        data.vehicles[0].assignments[0].events[0].assignment,
        data.vehicles[0].assignments[0].events[0].communicated_time,
        data.vehicles[0].assignments[0].events[0].scheduled_time,
        data.vehicles[0].assignments[0].events[0].coordinates.x(),
        data.vehicles[0].assignments[0].events[0].coordinates.y(),
        data.vehicles[0].assignments[0].events[0].company,
        data.vehicles[0].assignments[0].events[0].id,
        data.vehicles[0].assignments[0].events[0].customer,
        data.vehicles[0].assignments[0].events[0].is_pickup,
        data.vehicles[0].assignments[0].events[0].request_id,
        data.vehicles[0].assignments[0].events[0].required_specs,
    );

    println!("for read data: ");

    println!(
        "number of assignments for vehicle 1: {} and number of the first assignments events: {}, departure: {}, arrival: {}, company: {}, vehicle: {}, id: {}",
        read_from_db_data.vehicles[0].assignments.len(),
        read_from_db_data.vehicles[0].assignments[0].events.len(),
        read_from_db_data.vehicles[0].assignments[0].departure,
        read_from_db_data.vehicles[0].assignments[0].arrival,
        read_from_db_data.vehicles[0].assignments[0].company,
        read_from_db_data.vehicles[0].assignments[0].vehicle,
        read_from_db_data.vehicles[0].assignments[0].id
    );
    println!(
        "event1: assginment:{},communicated_time:{},scheduled_time:{},x:{},y:{},company:{},id:{},customer:{},is_pickup:{},request_id:{},required_specs:{}",
        read_from_db_data.vehicles[0].assignments[0].events[0].assignment,
        read_from_db_data.vehicles[0].assignments[0].events[0].communicated_time,
        read_from_db_data.vehicles[0].assignments[0].events[0].scheduled_time,
        read_from_db_data.vehicles[0].assignments[0].events[0].coordinates.x(),
        read_from_db_data.vehicles[0].assignments[0].events[0].coordinates.y(),
        read_from_db_data.vehicles[0].assignments[0].events[0].company,
        read_from_db_data.vehicles[0].assignments[0].events[0].id,
        read_from_db_data.vehicles[0].assignments[0].events[0].customer,
        read_from_db_data.vehicles[0].assignments[0].events[0].is_pickup,
        read_from_db_data.vehicles[0].assignments[0].events[0].request_id,
        read_from_db_data.vehicles[0].assignments[0].events[0].required_specs,
    );*/
}

fn print_vehicles_of_company(
    data: &Data,
    company_id: usize,
) {
    let vehicles_company = data.get_vehicles(company_id, None);

    println!("vehicles of company {}:", company_id);
    for (_, vehicles) in vehicles_company.iter() {
        for vehicle in vehicles.iter() {
            println!("id: {}", vehicle.id);
        }
    }
}
