#![no_main]
use libfuzzer_sys::fuzz_target;
use rand::seq::SliceRandom;

#[derive(Clone)]
enum Action {
    InsertVehicle,
    InsertCompany,
    InsertUser,
    InsertAvailability,
    ProcessRequest,
}

fuzz_target!(|dat: &[u8]| {
    /*let mut data = Data::new();
    let mut read_from_db_data = Data::new();
    let iterations = 100;
    let actions_per_iteration = 10;
    let actions = vec![
        Action::InsertVehicle,
        Action::InsertCompany,
        Action::InsertUser,
        Action::InsertAvailability,
    ];
    for i in 0..iterations {
        for j in 0..actions_per_iteration {
            let mut r = rand::thread_rng();
            let mut action: Action = *actions.choose(&mut r).unwrap();
            match action {
                Action::InsertVehicle => data.create_vehicle(),
                Action::InsertCompany => data.create_company(),
                Action::InsertUser => data.create_user(),
                Action::InsertAvailability => data.create_availability(),
                Action::ProcessRequest => (),
            }
        }
        read_from_db_data.clear();
        read_from_db_data.read_data();
        assert_eq!(data == read_from_db_data, true);
        assert_eq!(data.are_intervals_overlapping(), false);
    }*/
});
