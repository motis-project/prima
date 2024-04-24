use crate::{
    backend::interval::Interval,
    constants::constants::{BEELINE_KMH, KM_PRICE, MINUTE_PRICE},
    entities::{
        assignment::{self},
        availability, company, event,
        prelude::{
            Assignment, Availability, Company, Event, User, Vehicle, VehicleSpecifics, Zone,
        },
        user, vehicle, vehicle_specifics, zone,
    },
    error,
    init::AppState,
    osrm::{
        Coordinate,
        Dir::{Backward, Forward},
        DistTime, OSRM,
    },
    State,
};

use super::geo_from_str::multi_polygon_from_str;
use ::anyhow::Result;
use chrono::{Duration, NaiveDateTime, Utc};
use geo::{prelude::*, MultiPolygon, Point};
use hyper::StatusCode;
use itertools::Itertools;
use migration::RcOrArc;
use sea_orm::{ActiveModelTrait, ActiveValue, DatabaseConnection, DbConn, EntityTrait};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};

/*
StatusCode and associated errors/results:
INTERNAL_SERVER_ERROR           something bad happened
BAD_REQUEST                     invalid geojson for multipolygon (area of zone)
EXPECTATION_FAILED              foreign key violation
CONFLICT                        unique key violation
NO_CONTENT                      used in remove_interval and handle_request, request did not produce an error but did not change anything either (in case of request->denied)
NOT_ACCEPTABLE                  provided interval is not valid
NOT_FOUND                       data with provided id was not found
CREATED                         request processed succesfully, data has been created
OK                              request processed succesfully
*/

fn id_to_vec_pos(id: i32) -> usize {
    (id - 1) as usize
}

fn seconds_to_minutes(secs: i32) -> i32 {
    secs / 60
}

fn meter_to_km(m: i32) -> i32 {
    m / 1000
}

fn meter_to_km_f(m: f64) -> f64 {
    m / 1000.0
}

fn hrs_to_minutes(h: f64) -> i64 {
    (h * 60.0) as i64
}

struct Combination {
    is_start_company: bool,
    start_pos: usize,
    is_target_company: bool,
    target_pos: usize,
    cost: i32,
}

#[derive(Clone, PartialEq, Serialize)]
#[readonly::make]
pub struct AssignmentData {
    pub id: i32,
    pub departure: NaiveDateTime,
    pub arrival: NaiveDateTime,
    pub vehicle: i32,
}

impl AssignmentData {
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, departure: {}, arrival: {}\n",
            indent, self.id, self.departure, self.arrival
        );
    }
}

#[derive(Clone, Eq, PartialEq, Serialize)]
#[readonly::make]
pub struct AvailabilityData {
    pub id: i32,
    pub interval: Interval,
}

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct UserData {
    pub id: i32,
    pub name: String,
    pub is_driver: bool,
    pub is_admin: bool,
    pub email: String,
    pub password: Option<String>,
    pub salt: String,
    pub o_auth_id: Option<String>,
    pub o_auth_provider: Option<String>,
}

#[derive(Clone, PartialEq, Serialize)]
#[readonly::make]
pub struct VehicleData {
    pub id: i32,
    pub license_plate: String,
    pub company: i32,
    pub specifics: i32,
    pub active: bool,
    pub availability: HashMap<i32, AvailabilityData>,
    pub assignments: HashMap<i32, AssignmentData>,
}

impl VehicleData {
    async fn add_availability(
        &mut self,
        db: &DbConn,
        new_interval: &mut Interval,
        id_or_none: Option<i32>, //None->insert availability into db, this yields the id->create availability in data with this id.  Some->create in data with given id, nothing to do in db
    ) -> StatusCode {
        let mut mark_delete: Vec<i32> = Vec::new();
        for (id, existing) in self.availability.iter() {
            if !existing.interval.touches(&new_interval) {
                continue;
            }
            if existing.interval.contains(&new_interval) {
                return StatusCode::CREATED;
            }
            if new_interval.contains(&existing.interval) {
                mark_delete.push(*id);
            }
            if new_interval.overlaps(&existing.interval) {
                mark_delete.push(*id);
                new_interval.merge(&existing.interval);
            }
        }
        for to_delete in mark_delete {
            match Availability::delete_by_id(self.availability[&to_delete].id)
                // .exec(s.clone().db())
                .exec(db)
                .await
            {
                Ok(_) => {
                    self.availability.remove(&to_delete);
                }
                Err(e) => {
                    error!("Error deleting interval: {e:?}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            }
        }
        let id = match id_or_none {
            Some(i) => i,
            None => match Availability::insert(availability::ActiveModel {
                id: ActiveValue::NotSet,
                start_time: ActiveValue::Set(new_interval.start_time),
                end_time: ActiveValue::Set(new_interval.end_time),
                vehicle: ActiveValue::Set(self.id),
            })
            .exec(db)
            .await
            {
                Ok(result) => result.last_insert_id,
                Err(e) => {
                    error!("Error creating availability in db: {}", e);
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            },
        };
        match self.availability.insert(
            id,
            AvailabilityData {
                id,
                interval: *new_interval,
            },
        ) {
            None => return StatusCode::CREATED,
            Some(_) => {
                error!("Key already existed in availability");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
    }
}

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct EventData {
    pub coordinates: Point,
    pub scheduled_time: NaiveDateTime,
    pub communicated_time: NaiveDateTime,
    pub customer: i32,
    pub assignment: i32,
    pub required_specs: i32,
    pub request_id: i32,
    pub id: i32,
    pub is_pickup: bool,
}
impl EventData {
    fn from(
        id: i32,
        lat: f32,
        lng: f32,
        scheduled_time: NaiveDateTime,
        communicated_time: NaiveDateTime,
        customer: i32,
        assignment: i32,
        required_specs: i32,
        request_id: i32,
        is_pickup: bool,
    ) -> Self {
        Self {
            coordinates: Point::new(lat as f64, lng as f64),
            id,
            scheduled_time,
            communicated_time,
            customer,
            assignment,
            request_id,
            required_specs,
            is_pickup,
        }
    }

    fn print(
        &self,
        indent: &str,
    ) {
        print!(
            "{}id: {}, scheduled_time: {}, communicated_time: {}, customer: {}, assignment: {}, request_id: {}, required_specs: {}, is_pickup: {}\n",
            indent, self.id, self.scheduled_time, self.communicated_time, self.customer, self.assignment, self.request_id, self.required_specs, self.is_pickup
        );
    }
}

#[derive(PartialEq)]
#[readonly::make]
pub struct CompanyData {
    pub id: i32,
    pub central_coordinates: Point,
    pub zone: i32,
    pub name: String,
}

#[derive(PartialEq)]
#[readonly::make]
pub struct VehicleSpecificsData {
    pub id: i32,
    pub seats: i32,
    pub wheelchairs: i32,
    pub storage_space: i32,
}

impl VehicleSpecificsData {
    fn fulfills(
        &self,
        seats: i32,
        wheelchairs: i32,
        storage: i32,
    ) -> bool {
        if self.seats >= seats && self.wheelchairs >= wheelchairs && self.storage_space >= storage {
            return true;
        }
        return false;
    }
}

#[derive(PartialEq)]
#[readonly::make]
pub struct ZoneData {
    pub area: MultiPolygon,
    pub name: String,
    pub id: i32,
}

#[derive(PartialEq)]
#[readonly::make]
pub struct Data {
    pub users: HashMap<i32, UserData>,
    pub zones: Vec<ZoneData>,                         //indexed by (id-1)
    pub companies: Vec<CompanyData>,                  //indexed by (id-1)
    pub vehicles: Vec<VehicleData>,                   //indexed by (id-1)
    pub vehicle_specifics: Vec<VehicleSpecificsData>, //indexed by (id-1)
    pub events: HashMap<i32, EventData>,
    pub next_request_id: i32,
}

impl Data {
    pub fn new() -> Self {
        Self {
            zones: Vec::<ZoneData>::new(),
            companies: Vec::<CompanyData>::new(),
            vehicles: Vec::<VehicleData>::new(),
            vehicle_specifics: Vec::<VehicleSpecificsData>::new(),
            users: HashMap::<i32, UserData>::new(),
            events: HashMap::new(),
            next_request_id: 1,
        }
    }

    #[allow(dead_code)] //test/output function
    pub fn clear(&mut self) {
        self.users.clear();
        self.companies.clear();
        self.vehicles.clear();
        self.vehicle_specifics.clear();
        self.zones.clear();
        self.next_request_id = 1;
    }

    //expected to be used in fuzzing tests
    //check wether there is a vehicle for which any of the availability intervals touch
    #[allow(dead_code)] //test/output function
    pub fn do_intervals_touch(&self) -> bool {
        self.vehicles
            .iter()
            .map(|vehicle| &vehicle.availability)
            .any(|availability| {
                let availability_intervals = availability
                    .iter()
                    .map(|(_, availability)| availability.interval);
                availability_intervals
                    .clone()
                    .zip(availability_intervals)
                    .filter(|interval_pair| interval_pair.0 != interval_pair.1)
                    .any(|interval_pair| interval_pair.0.touches(&interval_pair.1))
            })
    }

    #[allow(dead_code)] //test/output function
    fn print_assignments(
        &self,
        print_events: bool,
    ) {
        for (a_id, assignment) in self
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.assignments)
        {
            assignment.print("");
            if print_events {
                for (_, event) in self.events.iter() {
                    if *a_id != event.assignment {
                        continue;
                    }
                    event.print("   ");
                }
            }
        }
    }

    pub async fn read_data_from_db(
        &mut self,
        db: &DbConn,
    ) {
        let zones: Vec<zone::Model> = Zone::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");
        for zone in zones.iter() {
            match multi_polygon_from_str(&zone.area) {
                Err(e) => error!("{e:?}"),
                Ok(mp) => self.zones.push(ZoneData {
                    area: mp,
                    name: zone.name.to_string(),
                    id: zone.id,
                }),
            }
        }

        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> = Company::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");
        for company_model in company_models {
            self.companies.push(CompanyData {
                name: company_model.name,
                zone: company_model.zone,
                central_coordinates: Point::new(
                    company_model.latitude as f64,
                    company_model.longitude as f64,
                ),
                id: company_model.id,
            });
        }

        let vehicle_models: Vec<<vehicle::Entity as sea_orm::EntityTrait>::Model> = Vehicle::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");
        for vehicle in vehicle_models.iter() {
            self.vehicles.push(VehicleData {
                id: vehicle.id,
                license_plate: vehicle.license_plate.to_string(),
                company: vehicle.company,
                specifics: vehicle.specifics,
                active: vehicle.active,
                availability: HashMap::new(),
                assignments: HashMap::new(),
            })
        }

        let availability_models: Vec<<availability::Entity as sea_orm::EntityTrait>::Model> =
            Availability::find()
                .all(db)
                .await
                .expect("Error while reading from Database.");
        for availability in availability_models.iter() {
            self.vehicles[id_to_vec_pos(availability.vehicle)]
                .add_availability(
                    db,
                    &mut Interval {
                        start_time: availability.start_time,
                        end_time: availability.end_time,
                    },
                    Some(availability.id),
                )
                .await;
        }

        let assignment_models: Vec<<assignment::Entity as sea_orm::EntityTrait>::Model> =
            Assignment::find()
                .all(db)
                .await
                .expect("Error while reading from Database.");
        for assignment in assignment_models {
            self.vehicles[id_to_vec_pos(assignment.vehicle)]
                .assignments
                .insert(
                    assignment.id,
                    AssignmentData {
                        arrival: assignment.arrival,
                        departure: assignment.departure,
                        id: assignment.id,
                        vehicle: assignment.vehicle,
                    },
                );
        }

        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> = Event::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");
        for event_m in event_models {
            self.events.insert(
                event_m.id,
                EventData::from(
                    event_m.id,
                    event_m.latitude,
                    event_m.longitude,
                    event_m.scheduled_time,
                    event_m.communicated_time,
                    event_m.customer,
                    event_m.chain_id,
                    event_m.required_vehicle_specifics,
                    event_m.request_id,
                    event_m.is_pickup,
                ),
            );
        }

        let user_models = User::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");
        for user_model in user_models {
            self.users.insert(
                user_model.id,
                UserData {
                    id: user_model.id,
                    name: user_model.name,
                    is_driver: user_model.is_driver,
                    is_admin: user_model.is_admin,
                    email: user_model.email,
                    password: user_model.password,
                    salt: user_model.salt,
                    o_auth_id: user_model.o_auth_id,
                    o_auth_provider: user_model.o_auth_provider,
                },
            );
        }

        let vehicle_specifics_models = VehicleSpecifics::find()
            .all(db)
            .await
            .expect("Error while reading from Database.");

        for specifics_m in vehicle_specifics_models.iter() {
            self.vehicle_specifics.push(VehicleSpecificsData {
                seats: specifics_m.seats,
                wheelchairs: specifics_m.wheelchairs,
                storage_space: specifics_m.storage_space,
                id: specifics_m.id,
            })
        }

        self.next_request_id = match self.events.iter().max_by_key(|(_, event)| event.request_id) {
            None => 1,
            Some(ev) => ev.1.request_id,
        };
    }

    async fn find_or_create_vehicle_specs(
        &mut self,
        db: &DbConn,
        seats: i32,
        wheelchairs: i32,
        storage_space: i32,
    ) -> i32 {
        for specs in self.vehicle_specifics.iter() {
            if seats == specs.seats
                && wheelchairs == specs.wheelchairs
                && storage_space == specs.storage_space
            {
                return specs.id;
            }
        }
        match VehicleSpecifics::insert(vehicle_specifics::ActiveModel {
            id: ActiveValue::NotSet,
            seats: ActiveValue::Set(seats),
            wheelchairs: ActiveValue::Set(wheelchairs),
            storage_space: ActiveValue::Set(storage_space),
        })
        .exec(db)
        .await
        {
            Ok(result) => {
                let last_insert_id = result.last_insert_id;
                self.vehicle_specifics.push(VehicleSpecificsData {
                    id: last_insert_id,
                    seats,
                    wheelchairs,
                    storage_space,
                });
                last_insert_id
            }
            Err(e) => {
                error!("{e:?}");
                return -1;
            }
        }
    }

    pub async fn create_vehicle(
        &mut self,
        db: &DbConn,
        license_plate: String,
        company: i32,
    ) -> StatusCode {
        if self.companies.len() < company as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        if self
            .vehicles
            .iter()
            .any(|vehicle| vehicle.license_plate == license_plate)
        {
            return StatusCode::CONFLICT;
        }
        //check whether the vehicle fits one of the existing vehicle_specs, otherwise create a new specs
        let specs_id = self
            .find_or_create_vehicle_specs(
                db, /*seats,
                    wheelchairs,
                    storage_space, */
                3, 0, 0,
            )
            .await;
        if specs_id == -1 {
            return StatusCode::INTERNAL_SERVER_ERROR;
        }

        match Vehicle::insert(vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            active: ActiveValue::Set(false),
            company: ActiveValue::Set(company),
            license_plate: ActiveValue::Set(license_plate.to_string()),
            specifics: ActiveValue::Set(specs_id),
        })
        .exec(db)
        .await
        {
            Ok(result) => {
                self.vehicles.push(VehicleData {
                    id: result.last_insert_id,
                    license_plate,
                    company,
                    specifics: specs_id,
                    active: false,
                    availability: HashMap::new(),
                    assignments: HashMap::new(),
                });
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    pub fn get_vehicle_by_id(
        &self,
        id: usize,
    ) -> &VehicleData {
        return self.vehicles.get(id).unwrap();
    }

    pub async fn does_user_with_name_exist(
        &self,
        name: &String,
    ) -> bool {
        return self.users.iter().any(|(_, user)| user.name == *name);
    }

    pub async fn does_user_with_email_exist(
        &self,
        email: &String,
    ) -> bool {
        return self.users.iter().any(|(_, user)| user.email == *email);
    }

    pub async fn create_user(
        &mut self,
        db: &DbConn,
        name: String,
        is_driver: bool,
        is_admin: bool,
        email: String,
        password: Option<String>,
        salt: String,
        o_auth_id: Option<String>,
        o_auth_provider: Option<String>,
    ) -> StatusCode {
        if self.does_user_with_email_exist(&email).await {
            return StatusCode::CONFLICT;
        }
        if self.does_user_with_name_exist(&name).await {
            return StatusCode::CONFLICT;
        }
        match User::insert(user::ActiveModel {
            id: ActiveValue::NotSet,
            name: ActiveValue::Set(name.clone()),
            is_driver: ActiveValue::Set(is_driver),
            is_admin: ActiveValue::Set(is_admin),
            email: ActiveValue::Set(email.clone()),
            password: ActiveValue::Set(password.clone()),
            salt: ActiveValue::Set(salt.clone()),
            o_auth_id: ActiveValue::Set(o_auth_id.clone()),
            o_auth_provider: ActiveValue::Set(o_auth_provider.clone()),
            is_active: ActiveValue::Set(true),
        })
        .exec(db)
        .await
        {
            Ok(result) => {
                let id = result.last_insert_id;
                self.users.insert(
                    id,
                    UserData {
                        id,
                        name,
                        is_driver,
                        is_admin,
                        email,
                        password,
                        salt,
                        o_auth_id,
                        o_auth_provider,
                    },
                );
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    pub async fn create_availability(
        &mut self,
        db: &DbConn,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle: i32,
    ) -> StatusCode {
        let mut interval = Interval {
            start_time,
            end_time,
        };
        if !interval.is_valid() {
            return StatusCode::NOT_ACCEPTABLE;
        }
        if self.vehicles.len() < vehicle as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        self.vehicles[id_to_vec_pos(vehicle)]
            .add_availability(db, &mut interval, None)
            .await
    }

    pub async fn create_zone(
        &mut self,
        db: &DbConn,
        name: String,
        area_str: String,
    ) -> StatusCode {
        if self.zones.iter().any(|zone| zone.name == name) {
            return StatusCode::CONFLICT;
        }
        let area = match multi_polygon_from_str(&area_str) {
            Err(_) => {
                return StatusCode::BAD_REQUEST;
            }
            Ok(mp) => mp,
        };
        match Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            name: ActiveValue::Set(name.to_string()),
            area: ActiveValue::Set(area_str.to_string()),
        })
        .exec(db)
        .await
        {
            Err(e) => {
                error!("{e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
            Ok(result) => {
                self.zones.push(ZoneData {
                    id: result.last_insert_id,
                    area,
                    name,
                });
                StatusCode::CREATED
            }
        }
    }

    pub async fn create_company(
        &mut self,
        db: &DbConn,
        name: String,
        zone: i32,
        lat: f32,
        lng: f32,
    ) -> StatusCode {
        if self.zones.len() < zone as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        if self.companies.iter().any(|company| company.name == name) {
            return StatusCode::CONFLICT;
        }
        match Company::insert(company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng),
            latitude: ActiveValue::Set(lat),
            name: ActiveValue::Set(name.to_string()),
            zone: ActiveValue::Set(zone),
        })
        .exec(db)
        .await
        {
            Ok(result) => {
                self.companies.push(CompanyData {
                    id: result.last_insert_id,
                    central_coordinates: Point::new(lat as f64, lng as f64),
                    zone,
                    name,
                });
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
    }

    pub async fn remove_availability(
        &mut self,
        db: &DbConn,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle_id: i32,
    ) -> StatusCode {
        if self.vehicles.len() <= vehicle_id as usize {
            return StatusCode::NOT_FOUND;
        }
        let to_remove_interval = Interval {
            start_time,
            end_time,
        };
        if !to_remove_interval.is_valid() {
            return StatusCode::NOT_ACCEPTABLE;
        }
        let mut mark_delete: Vec<i32> = Vec::new();
        let mut to_insert: Option<(Interval, Interval)> = None;
        let vehicle = &mut self.vehicles[id_to_vec_pos(vehicle_id)];
        let mut touched = false;
        for (id, existing) in vehicle.availability.iter_mut() {
            if !existing.interval.touches(&to_remove_interval) {
                continue;
            }
            touched = true;
            if existing.interval.contains(&to_remove_interval) {
                mark_delete.push(*id);
                to_insert = Some(existing.interval.split(&to_remove_interval));
                break;
            }
            if to_remove_interval.contains(&existing.interval) {
                mark_delete.push(*id);
                continue;
            }
            if to_remove_interval.overlaps(&existing.interval) {
                existing.interval.cut(&to_remove_interval);
                let mut active_m: availability::ActiveModel =
                    match Availability::find_by_id(existing.id).one(db).await {
                        Err(e) => {
                            error!("{e:?}");
                            return StatusCode::INTERNAL_SERVER_ERROR;
                        }
                        Ok(model_opt) => match model_opt {
                            None => return StatusCode::INTERNAL_SERVER_ERROR,
                            Some(model) => match (model as availability::Model).try_into() {
                                Err(e) => {
                                    error!("{e:?}");
                                    return StatusCode::INTERNAL_SERVER_ERROR;
                                }
                                Ok(active) => active,
                            },
                        },
                    };
                active_m.start_time = ActiveValue::set(existing.interval.start_time);
                active_m.end_time = ActiveValue::set(existing.interval.end_time);
                match Availability::update(active_m).exec(db).await {
                    Ok(_) => (),
                    Err(e) => {
                        error!("Error deleting interval: {e:?}");
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }
                }
            }
        }
        if !touched {
            return StatusCode::NO_CONTENT; //no error occured but the transmitted interval did not touch any availabilites for the transmitted vehicle
        }
        for to_delete in mark_delete {
            match Availability::delete_by_id(vehicle.availability[&to_delete].id)
                .exec(db)
                .await
            {
                Ok(_) => {
                    vehicle.availability.remove(&to_delete);
                }
                Err(e) => {
                    error!("Error deleting interval: {e:?}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            }
        }
        match to_insert {
            Some((left, right)) => {
                self.create_availability(db, left.start_time, left.end_time, vehicle_id)
                    .await;
                self.create_availability(db, right.start_time, right.end_time, vehicle_id)
                    .await;
            }
            None => (),
        }
        StatusCode::OK
    }

    //TODO: remove pub when events can be created by handling routing requests
    pub async fn insert_or_add_assignment(
        &mut self,
        assignment_id: Option<i32>, // assignment_id == None <=> assignment already exists
        departure: NaiveDateTime,
        arrival: NaiveDateTime,
        vehicle: i32,
        // State(s): State<&AppState>,
        db: &DbConn,
        start_address: &String,
        target_address: &String,
        lat_start: f32,
        lng_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
        customer: i32,
        required_vehicle_specs: i32,
        request_id: i32,
        connects_public_transport1: bool,
        connects_public_transport2: bool,
        lat_target: f32,
        lng_target: f32,
        sched_t_target: NaiveDateTime,
        comm_t_target: NaiveDateTime,
    ) -> StatusCode {
        if !(Interval {
            start_time: departure,
            end_time: arrival,
        })
        .is_valid()
            || !(Interval {
                start_time: sched_t_start,
                end_time: sched_t_target,
            })
            .is_valid()
            || !(Interval {
                start_time: comm_t_start,
                end_time: comm_t_target,
            })
            .is_valid()
        {
            return StatusCode::NOT_ACCEPTABLE;
        }
        if self.users.len() < customer as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        if self.vehicles.len() < vehicle as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        let id = match assignment_id {
            Some(a_id) => {
                //assignment already exists
                if self
                    .vehicles
                    .iter()
                    .flat_map(|vehicle| &vehicle.assignments)
                    .count()
                    < a_id as usize
                {
                    return StatusCode::EXPECTATION_FAILED;
                }
                a_id
            }
            None => {
                //assignment does not exist, create it in database, which yields the id
                println!("Vehicle insertion: {}", vehicle);
                let a_id = match Assignment::insert(assignment::ActiveModel {
                    id: ActiveValue::NotSet,
                    departure: ActiveValue::Set(departure),
                    arrival: ActiveValue::Set(arrival),
                    vehicle: ActiveValue::Set(vehicle),
                })
                .exec(db)
                .await
                {
                    Ok(result) => result.last_insert_id,
                    Err(e) => {
                        error!("Error creating assignment: {e:?}");
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }
                };
                //now create assignment in self(data)
                (&mut self.vehicles[id_to_vec_pos(vehicle)])
                    .assignments
                    .insert(
                        a_id,
                        AssignmentData {
                            id: a_id,
                            departure,
                            arrival,
                            vehicle,
                        },
                    );
                a_id
            }
        };
        let (start_event_id, target_event_id) = self
            .insert_event_pair_into_db(
                db,
                start_address,
                target_address,
                lat_start,
                lng_start,
                sched_t_start,
                comm_t_start,
                customer,
                id,
                required_vehicle_specs,
                request_id,
                connects_public_transport1,
                connects_public_transport2,
                lat_target,
                lng_target,
                sched_t_target,
                comm_t_target,
            )
            .await;
        if start_event_id == -1 {
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
        //pickup-event
        self.events.insert(
            start_event_id,
            EventData {
                coordinates: Point::new(lat_start as f64, lng_start as f64),
                scheduled_time: sched_t_start,
                communicated_time: comm_t_start,
                customer,
                assignment: id,
                required_specs: required_vehicle_specs,
                request_id,
                id: start_event_id,
                is_pickup: true,
            },
        );
        //dropoff-event
        self.events.insert(
            target_event_id,
            EventData {
                coordinates: Point::new(lat_target as f64, lng_target as f64),
                scheduled_time: sched_t_target,
                communicated_time: comm_t_target,
                customer,
                assignment: id,
                required_specs: required_vehicle_specs,
                request_id,
                id: target_event_id,
                is_pickup: false,
            },
        );
        StatusCode::CREATED
    }

    async fn insert_event_pair_into_db(
        &mut self,
        db: &DbConn,
        start_address: &String,
        target_address: &String,
        lat_start: f32,
        lng_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
        customer: i32,
        assignment: i32,
        required_vehicle_specs: i32,
        request_id: i32,
        connects_public_transport1: bool,
        connects_public_transport2: bool,
        lat_target: f32,
        lng_target: f32,
        sched_t_target: NaiveDateTime,
        comm_t_target: NaiveDateTime,
    ) -> (i32, i32) {
        let start_id = match Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_start),
            latitude: ActiveValue::Set(lat_start),
            scheduled_time: ActiveValue::Set(sched_t_start),
            communicated_time: ActiveValue::Set(comm_t_start),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(assignment),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(true),
            connects_public_transport: ActiveValue::Set(connects_public_transport1),
            address: ActiveValue::Set(start_address.to_string()),
        })
        .exec(db)
        .await
        {
            Ok(result) => result.last_insert_id,
            Err(e) => {
                error!("Error creating event: {e:?}");
                return (-1, -1);
            }
        };
        match Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_target),
            latitude: ActiveValue::Set(lat_target),
            scheduled_time: ActiveValue::Set(sched_t_target),
            communicated_time: ActiveValue::Set(comm_t_target),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(assignment),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(false),
            connects_public_transport: ActiveValue::Set(connects_public_transport2),
            address: ActiveValue::Set(target_address.to_string()),
        })
        .exec(db)
        .await
        {
            Ok(target_result) => (start_id, target_result.last_insert_id),
            Err(e) => {
                error!("Error creating event: {e:?}");
                return (-1, -1);
            }
        }
    }

    pub async fn handle_routing_request(
        &mut self,
        db: &DbConn,
        fixed_time: NaiveDateTime,
        is_start_time_fixed: bool,
        start_lat: f64,  //for Point  lat=y and lng is x
        start_lng: f64,  //for Point  lat=y and lng is x
        target_lat: f64, //for Point  lat=y and lng is x
        target_lng: f64, //for Point  lat=y and lng is x
        customer: i32,
        passengers: i32,
        start_address: &String,
        target_address: &String,
        //wheelchairs: i32, luggage: i32,
    ) -> StatusCode {
        let minimum_prep_time: Duration = Duration::hours(1);
        let now: NaiveDateTime = Utc::now().naive_utc();
        if now > fixed_time {
            return StatusCode::BAD_REQUEST;
        }
        if is_start_time_fixed && now + minimum_prep_time > fixed_time {
            return StatusCode::NO_CONTENT;
        }
        if passengers > 3 {
            return StatusCode::NO_CONTENT;
        }

        let start = Point::new(start_lat as f64, start_lng as f64);
        let target = Point::new(target_lat as f64, target_lng as f64);
        let beeline_time = Duration::minutes(hrs_to_minutes(
            meter_to_km_f(start.geodesic_distance(&target)) / BEELINE_KMH,
        ));
        let (start_time, target_time) = if is_start_time_fixed {
            (fixed_time, fixed_time + beeline_time)
        } else {
            (fixed_time - beeline_time, fixed_time)
        };

        //find companies, and vehicles that may process the request according to their zone, availability, collisions with other assignments and vehicle-specifics (based on beeline distance)
        let viable_vehicles = self
            .get_viable_vehicles(
                Interval {
                    start_time,
                    end_time: target_time,
                },
                passengers,
                &start,
            )
            .await;

        let viable_companies = viable_vehicles
            .iter()
            .map(|(company_id, _)| &self.companies[id_to_vec_pos(*company_id)])
            .collect_vec();

        println!("viable vehicles:");
        for (c, vs) in viable_vehicles.iter() {
            println!("company: {}", c);
            for v in vs {
                println!("  vehicle: {}", v.id);
            }
        }
        //get the actual costs
        let start_c = Coordinate {
            lng: start_lat,
            lat: start_lng,
        };
        let target_c = Coordinate {
            lng: target_lat,
            lat: target_lng,
        };
        let mut start_many = Vec::<Coordinate>::new();
        for company in viable_companies.iter() {
            start_many.push(Coordinate {
                lat: company.central_coordinates.y(),
                lng: company.central_coordinates.x(),
            });
        }
        // add this to get distance between start and target of the new request
        start_many.push(Coordinate {
            lat: target_c.lat,
            lng: target_c.lng,
        });
        let osrm = OSRM::new();
        let mut distances_to_start: Vec<DistTime> =
            match osrm.one_to_many(start_c, start_many, Backward).await {
                Ok(r) => r,
                Err(e) => {
                    error!("problem with osrm: {}", e);
                    Vec::new()
                }
            };
        let mut target_many = Vec::<Coordinate>::new();
        for company in viable_companies.iter() {
            target_many.push(Coordinate {
                lat: company.central_coordinates.y(),
                lng: company.central_coordinates.x(),
            });
        }
        let distances_to_target: Vec<DistTime> =
            match osrm.one_to_many(target_c, target_many, Forward).await {
                Ok(r) => r,
                Err(e) => {
                    error!("problem with osrm: {}", e);
                    Vec::new()
                }
            };

        let travel_duration = match distances_to_start.last() {
            Some(dt) => Duration::minutes(seconds_to_minutes(dt.time as i32) as i64),
            None => {
                error!("distances to start was empty");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        };
        //start/target times using travel time
        let start_time = if is_start_time_fixed {
            fixed_time
        } else {
            fixed_time - travel_duration
        };
        let target_time = if is_start_time_fixed {
            fixed_time + travel_duration
        } else {
            fixed_time
        };
        if now + minimum_prep_time > start_time {
            return StatusCode::NO_CONTENT;
        }
        distances_to_start.truncate(distances_to_start.len() - 1); //remove distance from start to target

        //create all viable combinations
        let mut viable_combinations: Vec<Combination> = Vec::new();
        for (pos_in_viable, company) in viable_companies.iter().enumerate() {
            let pos_in_data = id_to_vec_pos(company.id);
            let start_dist_time = distances_to_start[pos_in_viable];
            let target_dist_time = distances_to_target[pos_in_viable];

            let company_start_cost = seconds_to_minutes(start_dist_time.time as i32) * MINUTE_PRICE
                + meter_to_km(start_dist_time.dist as i32) * KM_PRICE;

            let company_target_cost = seconds_to_minutes(target_dist_time.time as i32)
                * MINUTE_PRICE
                + meter_to_km(target_dist_time.dist as i32) * KM_PRICE;
            viable_combinations.push(Combination {
                is_start_company: true,
                start_pos: pos_in_data,
                is_target_company: true,
                target_pos: pos_in_data,
                cost: company_start_cost + company_target_cost,
            });
        }

        if viable_combinations.is_empty() {
            return StatusCode::NO_CONTENT;
        }

        //use cost function to sort the viable combinations
        viable_combinations.sort_by(|a, b| a.cost.cmp(&(b.cost)));

        self.next_request_id += 1;
        let status_code = self
            .insert_or_add_assignment(
                None,
                start_time,
                target_time,
                1,
                db,
                start_address,
                target_address,
                start_lat as f32,
                start_lng as f32,
                start_time,
                start_time,
                customer,
                1,
                self.next_request_id,
                false,
                false,
                target_lat as f32,
                target_lng as f32,
                target_time,
                target_time,
            )
            .await;
        status_code
    }

    pub async fn change_vehicle_for_assignment(
        &mut self,
        db: &DbConn,
        assignment_id: i32,
        new_vehicle_id: i32,
    ) -> StatusCode {
        if id_to_vec_pos(new_vehicle_id) > self.vehicles.len() {
            return StatusCode::NOT_FOUND;
        }
        let vehicles = &mut self.vehicles;
        let old_vehicle_id_vec: Vec<i32> = vehicles
            .iter()
            .filter(|vehicle| {
                vehicle
                    .assignments
                    .iter()
                    .any(|(id, _)| *id == assignment_id)
            })
            .map(|vehicle| vehicle.id)
            .collect();
        if old_vehicle_id_vec.is_empty() {
            return StatusCode::NOT_FOUND;
        }
        if old_vehicle_id_vec.len() > 1 {
            error!("bad backend state: one assignment assigned to multiple cars");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
        let old_vehicle_id = old_vehicle_id_vec[0];

        let mut assignment_to_move = match vehicles[id_to_vec_pos(old_vehicle_id)]
            .assignments
            .remove(&assignment_id)
        {
            None => {
                error!("Assignment missing");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
            Some(a) => a,
        };
        assignment_to_move.vehicle = new_vehicle_id;

        vehicles[id_to_vec_pos(new_vehicle_id)]
            .assignments
            .insert(assignment_to_move.id, assignment_to_move.clone());

        let mut active_m: assignment::ActiveModel =
            match Assignment::find_by_id(assignment_to_move.id).one(db).await {
                Err(e) => {
                    error!("{e:?}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
                Ok(m) => match m {
                    None => return StatusCode::INTERNAL_SERVER_ERROR,
                    Some(model) => match (model as assignment::Model).try_into() {
                        Err(e) => {
                            error!("{e:?}");
                            return StatusCode::INTERNAL_SERVER_ERROR;
                        }
                        Ok(active) => active,
                    },
                },
            };
        active_m.vehicle = ActiveValue::Set(new_vehicle_id);
        match active_m.update(db).await {
            Ok(_) => (),
            Err(e) => {
                error!("{}", e);
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
        StatusCode::ACCEPTED
    }

    //keys of returned hashmap are the company-ids of the vehicles in the associated value
    async fn get_viable_vehicles(
        &self,
        interval: Interval,
        passengers: i32,
        start: &Point,
    ) -> HashMap<i32, Vec<&VehicleData>> {
        let companies = self
            .companies
            .iter()
            .filter(|company| self.zones[id_to_vec_pos(company.zone)].area.contains(start))
            .collect_vec();
        self.vehicles
            .iter()
            .filter(|vehicle| {
                companies.contains(&&self.companies[id_to_vec_pos(vehicle.company)])
                    && self.vehicle_specifics[id_to_vec_pos(vehicle.specifics)]
                        .fulfills(passengers, 0, 0)
                    && !vehicle.assignments.iter().any(|(_, assignment)| {
                        //this check might disallow some concatenations of jobs where time is saved by not having to return to the company central, TODO: fix when concatenations should be supported
                        Interval {
                            start_time: assignment.departure,
                            end_time: assignment.arrival,
                        }
                        .touches(&interval)
                    }
                    && vehicle.availability.iter().any(|(_,availability)|availability.interval.contains(&interval)))
            })
            .into_group_map_by(|vehicle| vehicle.company)
    }

    async fn get_companies_containing_point(
        &self,
        start: &Point,
    ) -> Vec<&CompanyData> {
        let viable_zone_ids = self
            .zones
            .iter()
            .filter(|zone| zone.area.contains(start))
            .map(|zone| zone.id)
            .collect_vec();
        let viable_companies = self
            .companies
            .iter()
            .filter(|company| viable_zone_ids.contains(&(company.zone)))
            .collect_vec();
        viable_companies
    }

    pub async fn get_assignments_for_vehicle(
        &self,
        vehicle_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Vec<&AssignmentData> {
        let interval = Interval {
            start_time: time_frame_start,
            end_time: time_frame_end,
        };
        if self.vehicles.len() < id_to_vec_pos(vehicle_id) {
            return Vec::new();
        }
        self.vehicles[id_to_vec_pos(vehicle_id)]
            .assignments
            .iter()
            .map(|(_, assignment)| assignment)
            .filter(|assignment| {
                interval.touches(&Interval {
                    start_time: assignment.departure,
                    end_time: assignment.arrival,
                })
            })
            .collect_vec()
    }

    pub async fn get_events_for_vehicle(
        &self,
        vehicle_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Vec<&EventData> {
        let interval = Interval {
            start_time: time_frame_start,
            end_time: time_frame_end,
        };
        if self.vehicles.len() < id_to_vec_pos(vehicle_id) {
            return Vec::new();
        }
        self.events
            .iter()
            .filter(|(_, event)| {
                interval.touches(&Interval {
                    start_time: event.scheduled_time,
                    end_time: event.communicated_time,
                }) && self.vehicles[id_to_vec_pos(vehicle_id)]
                    .assignments
                    .iter()
                    .any(|(a_id, _)| event.assignment == *a_id)
            })
            .map(|(_, e)| e)
            .collect_vec()
    }

    pub async fn get_vehicles(
        &self,
        company_id: i32,
        active: Option<bool>,
    ) -> HashMap<i32, Vec<&VehicleData>> {
        self.vehicles
            .iter()
            .filter(|vehicle| {
                vehicle.company == company_id
                /* && match active {
                    Some(a) => a == vehicle.active,
                    None => true,
                } */
            })
            .into_group_map_by(|v| v.specifics)
    }

    pub async fn get_vehicles_(
        &self,
        company_id: i32,
        active: Option<bool>,
    ) -> Vec<&VehicleData> {
        self.vehicles
            .iter()
            .filter(|vehicle| {
                vehicle.company == company_id
                /* && match active {
                    Some(a) => a == vehicle.active,
                    None => true,
                } */
            })
            .collect()
    }

    pub async fn get_events_for_user(
        &self,
        user_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Vec<&EventData> {
        let interval = Interval {
            start_time: time_frame_start,
            end_time: time_frame_end,
        };
        self.events
            .iter()
            .filter(|(_, event)| {
                let mut event_interval = Interval {
                    start_time: event.scheduled_time,
                    end_time: event.communicated_time,
                };
                event_interval.flip_if_necessary();
                interval.touches(&event_interval) && event.customer == user_id
            })
            .map(|(_, event)| event)
            .collect_vec()
    }

    //return vectors of conflicting assignments by vehicle ids as keys
    pub async fn get_company_conflicts_for_assignment(
        &self,
        company_id: i32,
        assignment_id: i32,
    ) -> Result<HashMap<i32, Vec<&AssignmentData>>, StatusCode> {
        let assignments = self
            .vehicles
            .iter()
            .filter(|vehicle| {
                vehicle.company == company_id
                    && vehicle
                        .assignments
                        .iter()
                        .any(|(a_id, _)| *a_id == assignment_id)
            })
            .map(|vehicle| &vehicle.assignments[&assignment_id])
            .collect_vec();
        if assignments.len() > 1 {
            error!("bad backend state, multiple assignments with same id");
        }
        if assignments.is_empty() {
            return Err(StatusCode::NOT_FOUND);
        }
        let interval = Interval {
            start_time: assignments[0].departure,
            end_time: assignments[0].arrival,
        };

        let mut ret = HashMap::<i32, Vec<&AssignmentData>>::new();
        self.vehicles
            .iter()
            .filter(|vehicle| vehicle.company == company_id)
            .for_each(|vehicle| {
                let conflicts = vehicle
                    .assignments
                    .iter()
                    .map(|(_, assignment)| assignment)
                    .filter(|assignment| {
                        interval.touches(&Interval {
                            start_time: assignment.departure,
                            end_time: assignment.arrival,
                        })
                    })
                    .collect_vec();
                if !conflicts.is_empty() {
                    ret.insert(vehicle.id, conflicts);
                }
            });
        Ok(ret)
    }

    pub async fn get_vehicle_conflicts_for_assignment(
        &self,
        vehicle_id: i32,
        assignment_id: i32,
    ) -> Vec<&AssignmentData> {
        let intervals = self
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.assignments)
            .map(|(_, a)| a)
            .filter(|assignment| assignment.id == assignment_id)
            .map(|assignment| Interval {
                start_time: assignment.departure,
                end_time: assignment.arrival,
            })
            .collect_vec();
        if intervals.len() > 1 {
            error!("bad backend state, multiple assignments with same id");
            return Vec::new();
        }
        if intervals.is_empty() {
            return Vec::new();
        }
        self.vehicles[id_to_vec_pos(vehicle_id)]
            .assignments
            .iter()
            .map(|(_, a)| a)
            .filter(|assignment| {
                assignment.id != assignment_id
                    && intervals[0].touches(&Interval {
                        start_time: assignment.departure,
                        end_time: assignment.arrival,
                    })
            })
            .collect_vec()
    }
}

pub fn get_or_init() -> &'static Mutex<Data> {
    static data: OnceLock<Mutex<Data>> = OnceLock::new();
    data.get_or_init(|| Mutex::new(Data::new()))
}
/*
#[cfg(test)]
mod test {
    use std::collections::HashMap;

    use super::ZoneData;
    use crate::{
        backend::data::Data,
        constants::{geo_points::TestPoints, gorlitz::GORLITZ},
        dotenv, env,
        init::{self, StopFor::TEST1},
        AppState, Arc, Database, Migrator, Mutex, Tera,
    };
    use axum::extract::State;
    use chrono::{NaiveDate, NaiveDateTime, Timelike};
    use geo::{Contains, Point};
    use hyper::StatusCode;
    use migration::MigratorTrait;

    async fn check_zones_contain_correct_points(
        d: &Data,
        points: &Vec<Point>,
        expected_zones: i32,
    ) {
        for point in points.iter() {
            for company in &d.get_companies_containing_point(point).await {
                assert_eq!(company.zone == expected_zones, true);
            }
        }
    }
    fn check_points_in_zone(
        expect: bool,
        zone: &ZoneData,
        points: &Vec<Point>,
    ) {
        for point in points.iter() {
            assert_eq!(zone.area.contains(point), expect);
        }
    }
    async fn check_data_db_synchronized(
        State(s): State<&AppState>,
        data: &Data,
        read_data: &mut Data,
    ) {
        read_data.clear();
        read_data.read_data_from_db(State(&s)).await;
        assert_eq!(read_data == data, true);
    }
    #[tokio::test]
    async fn test() {
        dotenv().ok();
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        Migrator::up(&conn, None).await.unwrap();

        let tera = match Tera::new(
            "html/**/
            *.html",
        ) {
            Ok(t) => Arc::new(Mutex::new(t)),
            Err(e) => {
                println!("Parsing error(s): {}", e);
                ::std::process::exit(1);
            }
        };

        let mut s = AppState {
            tera: tera,
            db: Arc::new(conn),
            data: Arc::new(Data::new()),
        };
        let mut d = init::init(State(&s), true, TEST1).await;
        s.data = Arc::new(d);

        assert_eq!(d.vehicles.len(), 29);
        assert_eq!(d.zones.len(), 3);
        assert_eq!(d.companies.len(), 8);

        let mut read_data = Data::new();
        check_data_db_synchronized(State(&s), &d, &mut read_data).await;

        let test_points = TestPoints::new();
        //zonen tests:
        //0->Bautzen Ost
        check_points_in_zone(true, &d.zones[0], &test_points.bautzen_ost);
        check_points_in_zone(false, &d.zones[0], &test_points.bautzen_west);
        check_points_in_zone(false, &d.zones[0], &test_points.gorlitz);
        check_points_in_zone(false, &d.zones[0], &test_points.outside);
        //1->Bautzen West
        check_points_in_zone(false, &d.zones[1], &test_points.bautzen_ost);
        check_points_in_zone(true, &d.zones[1], &test_points.bautzen_west);
        check_points_in_zone(false, &d.zones[1], &test_points.gorlitz);
        check_points_in_zone(false, &d.zones[1], &test_points.outside);
        //2->Görlitz
        check_points_in_zone(false, &d.zones[2], &test_points.bautzen_ost);
        check_points_in_zone(false, &d.zones[2], &test_points.bautzen_west);
        check_points_in_zone(true, &d.zones[2], &test_points.gorlitz);
        check_points_in_zone(false, &d.zones[2], &test_points.outside);

        check_zones_contain_correct_points(&d, &test_points.bautzen_ost, 1).await;
        check_zones_contain_correct_points(&d, &test_points.bautzen_west, 2).await;
        check_zones_contain_correct_points(&d, &test_points.gorlitz, 3).await;
        check_zones_contain_correct_points(&d, &test_points.outside, -1).await;

        //remove_availability and create_availability_____________________________________________________________________________________________________________________________________________
        assert_eq!(d.vehicles[0].availability.len(), 1);
        d.create_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap(),
            1,
        )
        .await;
        //add non-touching
        assert_eq!(d.vehicles[0].availability.len(), 2);

        d.create_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            1,
        )
        .await;
        //add touching in 1 point
        assert_eq!(d.vehicles[0].availability.len(), 2);

        d.create_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 13, 0)
                .unwrap(),
            1,
        )
        .await;
        //add containing/contained (equal)
        assert_eq!(d.vehicles[0].availability.len(), 2);

        d.remove_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 11, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            1,
        )
        .await;
        //remove split
        assert_eq!(d.vehicles[0].availability.len(), 3);

        d.remove_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 13, 0)
                .unwrap(),
            1,
        )
        .await;
        //remove containing
        assert_eq!(d.vehicles[0].availability.len(), 1);

        d.remove_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 13, 0)
                .unwrap(),
            1,
        )
        .await;
        //remove non-touching
        assert_eq!(d.vehicles[0].availability.len(), 1);
        assert_eq!(
            d.vehicles[0].availability[&1].interval.start_time.hour(),
            10
        );
        assert_eq!(
            d.vehicles[0].availability[&1].interval.start_time.minute(),
            10
        );

        d.remove_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(11, 0, 0)
                .unwrap(),
            1,
        )
        .await;
        //remove overlapping
        assert_eq!(d.vehicles[0].availability.len(), 1);
        assert_eq!(
            d.vehicles[0].availability[&1].interval.start_time.hour(),
            11
        );
        assert_eq!(
            d.vehicles[0].availability[&1].interval.start_time.minute(),
            0
        );

        //get_company_conflicts_for_assignment_____________________________________________________________________________________________________________________________________________
        for company in d.companies.iter() {
            let conflicts = match d.get_company_conflicts_for_assignment(company.id, 1).await {
                Ok(c) => c,
                Err(_) => HashMap::new(),
            };
            assert_eq!(conflicts.is_empty(), company.id != 1);
            for (v, assignments) in conflicts.iter() {
                assert_eq!(company.id, 1);
                assert_eq!(assignments.len() == 0, *v != 2);
            }
        }

        //get_events_for_user_____________________________________________________________________________________________________________________________________________
        for (user_id, _) in d.users.iter() {
            assert_eq!(
                d.get_events_for_user(*user_id, NaiveDateTime::MIN, NaiveDateTime::MAX)
                    .await
                    .is_empty(),
                *user_id != 2
            );
        }

        //get_vehicles_____________________________________________________________________________________________________________________________________________
        for company in d.companies.iter() {
            let vehicles = d.get_vehicles(company.id, None).await;
            for (specs, vehicles) in vehicles.iter() {
                assert_eq!(*specs, 1);
                assert_eq!((company.id == 1 || company.id == 8), vehicles.len() == 5);
                assert_eq!((company.id == 3 || company.id == 7), vehicles.len() == 4);
                assert_eq!(
                    (company.id == 2 || company.id == 5 || company.id == 6),
                    vehicles.len() == 3
                );
                assert_eq!(company.id == 4, vehicles.len() == 2);
            }
        }

        let p_in_bautzen_ost = test_points.bautzen_ost[0];
        let p_in_bautzen_west = test_points.bautzen_west[0];
        d.handle_routing_request(
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

        //validate UniqueKeyViolation handling when creating data (expect StatusCode::CONFLICT)_______________________________________________________
        //unique keys:  table               keys
        //              user                name, email
        //              zone                name
        //              company             name
        //              vehicle             license plate
        let n_users = d.users.len();
        //insert user with existing name
        assert_eq!(
            d.create_user(
                State(&s),
                "TestDriver1".to_string(),
                true,
                false,
                "test@gmail.com".to_string(),
                Some("".to_string()),
                "".to_string(),
                Some("".to_string()),
                Some("".to_string()),
            )
            .await,
            StatusCode::CONFLICT
        );
        //insert user with existing email
        assert_eq!(
            d.create_user(
                State(&s),
                "TestDriver2".to_string(),
                true,
                false,
                "test@aol.com".to_string(),
                Some("".to_string()),
                "".to_string(),
                Some("".to_string()),
                Some("".to_string()),
            )
            .await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.users.len(), n_users);
        //insert user with new name and email
        d.create_user(
            State(&s),
            "TestDriver2".to_string(),
            true,
            false,
            "test@gmail.com".to_string(),
            Some("".to_string()),
            "".to_string(),
            Some("".to_string()),
            Some("".to_string()),
        )
        .await;
        assert_eq!(d.users.len(), n_users + 1);
        let n_users = d.users.len();

        //insert zone with existing name
        let n_zones = d.zones.len();
        assert_eq!(
            d.create_zone(State(&s), "Görlitz".to_string(), GORLITZ.to_string())
                .await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.zones.len(), n_zones);

        //insert company with existing name
        let n_companies = d.companies.len();
        assert_eq!(
            d.create_company(
                State(&s),
                "Taxi-Unternehmen Bautzen-1".to_string(),
                1,
                1.0,
                1.0
            )
            .await,
            StatusCode::CONFLICT
        );

        //insert vehicle with existing license plate
        let n_vehicles = d.vehicles.len();
        assert_eq!(
            d.create_vehicle(State(&s), "TUB1-1".to_string(), 1).await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.vehicles.len(), n_vehicles);

        //Validate ForeignKeyViolation handling when creating data (expect StatusCode::EXPECTATION_FAILED)__________________________________________________________
        //foreign keys: table               keys
        //              company             zone
        //              vehicle             company specifics           TODO: test specifics when mvp restriction on specifics is lifted
        //              availability        vehicle
        //              assignment          vehicle                     TODO: test this when handle_request is testable
        //              event               user assignment specifics   TODO: test this when handle_request is testable

        //insert company with non-existing zone
        assert_eq!(
            d.create_company(
                State(&s),
                "some new name".to_string(),
                1 + n_zones as i32,
                1.0,
                1.0
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(d.companies.len(), n_companies);
        //insert company with existing zone
        assert_eq!(
            d.create_company(
                State(&s),
                "some new name".to_string(),
                n_zones as i32,
                1.0,
                1.0
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.companies.len(), n_companies + 1);
        let n_companies = d.companies.len();

        //insert vehicle with non-existing company
        assert_eq!(
            d.create_vehicle(
                State(&s),
                "some new license plate".to_string(),
                1 + n_companies as i32
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(d.vehicles.len(), n_vehicles);
        //insert vehicle with existing company
        assert_eq!(
            d.create_vehicle(
                State(&s),
                "some new license plate".to_string(),
                n_companies as i32
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.vehicles.len(), n_vehicles + 1);
        let n_vehicles = d.vehicles.len();

        //insert vehicle with non-existing vehicle-specifics should be added if specifics are no longer restricted for mvp->TODO

        //insert availability with non-existing vehicle
        let n_availabilities = d
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.availability)
            .count();
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1 + n_vehicles as i32
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //insert availability with existing vehicle
        let n_availabilities = d
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.availability)
            .count();
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(9, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                n_vehicles as i32
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities + 1
        );
        let n_availabilities = d
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.availability)
            .count();

        //Validate invalid multipolygon handling when creating zone (expect StatusCode::BAD_REQUEST)__________________________________________________________
        assert_eq!(
            d.create_zone(
                State(&s),
                "some new zone name".to_string(),
                "invalid multipolygon".to_string()
            )
            .await,
            StatusCode::BAD_REQUEST
        );
        assert_eq!(d.zones.len(), n_zones);

        //Validate invalid interval handling when creating data (expect StatusCode::NOT_ACCEPTABLE)__________________________________________________________
        //starttime > endtime
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //starttime before year 2024
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2023, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //endtime after year 100000
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(100000, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //remove
        //starttime > endtime
        assert_eq!(
            d.remove_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //starttime before year 2024
        assert_eq!(
            d.remove_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2023, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );
        //endtime after year 100000
        assert_eq!(
            d.remove_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(100000, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );

        //Validate nothing happened case handling when removing availabilies (expect StatusCode::NO_CONTENT)__________________________________________________________
        //endtime after year 100000
        assert_eq!(
            d.remove_availability(
                State(&s),
                NaiveDate::from_ymd_opt(2025, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2026, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                1
            )
            .await,
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|vehicle| &vehicle.availability)
                .count(),
            n_availabilities
        );

        //TODO: tests for insert_or_add_assignment
        check_data_db_synchronized(State(&s), &d, &mut read_data).await;
    }
}
*/

// PUBLIC INTERFACE

// pub async fn create_vehicle(
//     &mut self,
//     db: &DbConn,
//     license_plate: String,
//     company: i32,
// ) -> StatusCode {
// }
