use crate::{
    be::backend::{
        CreateCompany, CreateVehicle, CreateVehicleAvailability, CreateZone, Data, UserData,
    },
    constants::{
        bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
    },
    entities::{prelude::User, user},
    AppState,
};
use sea_orm::EntityTrait;

use axum::extract::State;
use chrono::NaiveDate;

pub async fn init(State(s): State<AppState>) {
    match User::find().all(s.clone().db()).await {
        Ok(u) => {
            if !u.is_empty() {
                println!("users already exist, not running init() again.");
                return;
            }
        }
        Err(_) => (),
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
}
