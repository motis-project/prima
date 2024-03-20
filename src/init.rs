use crate::{
    be::{
        backend::{
            CreateCapacity, CreateCompany, CreateVehicle, CreateZone, Data, GetCapacity, UserData,
        },
        interval,
    },
    constants::{
        bautzen_split_ost::BAUTZEN_OST, bautzen_split_west::BAUTZEN_WEST, gorlitz::GORLITZ,
    },
    AppState,
};

use axum::extract::State;
use chrono::NaiveDate;

/* pub async fn init(State(s): State<AppState>) {
    let mut data = Data::new();
    data.create_user(
        State(s.clone()),
        axum::Json(User {
            id: None,
            name: "Test".to_string(),
            is_driver: true,
            is_admin: true,
            email: "".to_string(),
            password: Some("".to_string()),
            salt: "".to_string(),
            o_auth_id: Some("".to_string()),
            o_auth_provider: Some("".to_string()),
        }),
    )
    .await;

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

    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 2,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(18, 00, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 1,
            amount: 5,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(9, 15, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 2,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(15, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 2,
            amount: 1,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(7, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 2,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(12, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(7, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(12, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 3,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(16, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 4,
            amount: 2,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(16, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 4,
            amount: 2,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 15, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 5,
            amount: 2,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(8, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(13, 15, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 5,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 35, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(7, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(11, 35, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 1,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(17, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 6,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 7,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 0, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 7,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 5,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(9, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 14)
                    .unwrap()
                    .and_hms_opt(12, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 3,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(8, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(13, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(10, 30, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 16)
                    .unwrap()
                    .and_hms_opt(15, 0, 0)
                    .unwrap(),
            },
        }),
    )
    .await;
    data.create_capacity(
        State(s.clone()),
        axum::Json(CreateCapacity {
            company: 8,
            amount: 4,
            interval: interval::Interval {
                start_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                end_time: NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(14, 30, 0)
                    .unwrap(),
            },
        }),
    )
    .await;

    data.insert_event_pair_into_db(
        State(s.clone()),
        &"".to_string(),
        14.225917859910453,
        51.26183078936296,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 20, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap(),
        1,
        1,
        1,
        1,
        false,
        false,
        14.324673828581723,
        51.336726303316794,
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap(),
        NaiveDate::from_ymd_opt(2024, 4, 15)
            .unwrap()
            .and_hms_opt(10, 10, 0)
            .unwrap(),
    )
    .await;

    let read_capacities = data
        .get_capacity(axum::Json(GetCapacity {
            company: 1,
            time_frame_end: None,
            time_frame_start: None,
        }))
        .await;
    for (key, caps) in read_capacities.iter() {
        for cap in caps.iter() {
            println!("interval found for capacity - get request with company: 1, vehicle specs: 1  and amount: {}:    {}",key,cap);
        }
    }
} */
