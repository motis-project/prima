use crate::{
    be::interval::{InfiniteInterval, Interval},
    constants::constants::{AIR_DIST_SPEED, KM_PRICE, MINUTE_PRICE, MINUTE_WAITING_PRICE},
    entities::{
        assignment::{self, ActiveModel},
        availability, company, event,
        prelude::{
            Assignment, Availability, Company, Event, User, Vehicle, VehicleSpecifics, Zone,
        },
        user, vehicle, vehicle_specifics, zone,
    },
    error,
    osrm::{Coordinate, DistTime, OSRM},
    AppState, State, StatusCode,
};

use ::anyhow::{anyhow, Context, Result};
use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use geo::{prelude::*, Point};
use itertools::Itertools;
use sea_orm::{ActiveModelTrait, ActiveValue, DeleteResult, EntityTrait};
use std::collections::HashMap;

use super::geo_from_str::{self, multi_polygon_from_str};

fn id_to_vec_pos(id: i32) -> usize {
    (id - 1) as usize
}

fn vec_pos_to_id(pos: usize) -> i32 {
    1 + pos as i32
}

fn seconds_to_minutes(secs: i32) -> i32 {
    secs / 60
}

fn meter_to_km(m: i32) -> i32 {
    m / 1000
}

struct Comb {
    is_start_company: bool,
    start_pos: usize,
    is_target_company: bool,
    target_pos: usize,
    cost: i32,
}

struct BestCombination {
    best_start_time_pos: usize,
    best_target_time_pos: usize,
}

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct AssignmentData {
    pub id: i32,
    pub departure: NaiveDateTime,
    pub arrival: NaiveDateTime,
    pub vehicle: i32,
    pub events: Vec<EventData>,
}

impl AssignmentData {
    fn new() -> Self {
        Self {
            id: -1,
            departure: NaiveDateTime::MIN,
            arrival: NaiveDateTime::MAX,
            vehicle: -1,
            events: Vec::new(),
        }
    }
}

#[derive(Clone, Eq, PartialEq)]
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

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct VehicleData {
    pub id: i32,
    pub license_plate: String,
    pub company: i32,
    pub specifics: i32,
    pub active: bool,
    pub availability: Vec<AvailabilityData>,
    pub assignments: Vec<AssignmentData>,
}

impl VehicleData {
    async fn add_availability(
        &mut self,
        State(s): State<AppState>,
        new_interval: &mut Interval,
        id_or_none: Option<i32>,
    ) {
        let mut mark_delete: Vec<usize> = Vec::new();
        for (pos, existing) in self.availability.iter().enumerate() {
            if !existing.interval.touches(&new_interval) {
                continue;
            }
            if existing.interval.contains(&new_interval) {
                return;
            }
            if new_interval.contains(&existing.interval) {
                mark_delete.push(pos);
            }
            if new_interval.overlaps(&existing.interval) {
                mark_delete.push(pos);
                new_interval.merge(&existing.interval);
            }
        }
        mark_delete.sort_by(|a, b| b.cmp(a));
        for to_delete in mark_delete {
            match Availability::delete_by_id(self.availability[to_delete].id)
                .exec(s.clone().db())
                .await
            {
                Ok(_) => {
                    self.availability.remove(to_delete);
                }
                Err(e) => error!("Error deleting interval: {e:?}"),
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
            .exec(s.db())
            .await
            {
                Ok(result) => result.last_insert_id,
                Err(_) => -1,
            },
        };
        if id == -1 {
            return;
        }
        self.availability.push(AvailabilityData {
            id,
            interval: *new_interval,
        })
    }

    fn find_collisions(
        &self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> Vec<EventData> {
        Vec::new() //TODO
    }

    fn is_available(
        &self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> bool {
        false //TODO
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

#[derive(PartialEq)]
#[readonly::make]
pub struct ZoneData {
    pub area: geo::MultiPolygon,
    pub name: String,
    pub id: i32,
}

#[derive(PartialEq)]
#[readonly::make]
pub struct Data {
    pub users: HashMap<i32, UserData>,
    pub zones: Vec<ZoneData>,
    pub companies: Vec<CompanyData>,
    pub vehicles: Vec<VehicleData>,
    pub vehicle_specifics: Vec<VehicleSpecificsData>,
    pub last_request_id: i32,
}

impl Data {
    pub fn new() -> Self {
        Self {
            zones: Vec::<ZoneData>::new(),
            companies: Vec::<CompanyData>::new(),
            vehicles: Vec::<VehicleData>::new(),
            vehicle_specifics: Vec::<VehicleSpecificsData>::new(),
            users: HashMap::<i32, UserData>::new(),
            last_request_id: 1,
        }
    }

    pub fn clear(&mut self) {
        self.users.clear();
        self.companies.clear();
        self.vehicles.clear();
        self.vehicle_specifics.clear();
        self.zones.clear();
    }

    //expected to be used in fuzzing tests
    #[allow(dead_code)]
    pub fn do_intervals_touch(&self) -> bool {
        self.vehicles
            .iter()
            .map(|vehicle| &vehicle.availability)
            .any(|availability| {
                availability
                    .iter()
                    .map(|availability| availability.interval)
                    .zip(
                        availability
                            .iter()
                            .map(|availability| availability.interval),
                    )
                    .filter(|availability_pair| availability_pair.0 != availability_pair.1)
                    .any(|availability_pair| availability_pair.0.touches(&availability_pair.1))
            })
    }

    pub async fn read_data(
        &mut self,
        State(s): State<AppState>,
    ) {
        let zones: Vec<zone::Model> = Zone::find().all(s.db()).await.unwrap();
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
        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> =
            Company::find().all(s.db()).await.unwrap();
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
        let vehicle_models: Vec<<vehicle::Entity as sea_orm::EntityTrait>::Model> =
            Vehicle::find().all(s.db()).await.unwrap();
        for vehicle in vehicle_models.iter() {
            self.vehicles.push(VehicleData {
                id: vehicle.id,
                license_plate: vehicle.license_plate.to_string(),
                company: vehicle.company,
                specifics: vehicle.specifics,
                active: vehicle.active,
                availability: Vec::new(),
                assignments: Vec::new(),
            })
        }
        let availability_models: Vec<<availability::Entity as sea_orm::EntityTrait>::Model> =
            Availability::find().all(s.db()).await.unwrap();

        for availability in availability_models.iter() {
            self.vehicles[id_to_vec_pos(availability.vehicle)]
                .add_availability(
                    State(s.clone()),
                    &mut Interval {
                        start_time: availability.start_time,
                        end_time: availability.end_time,
                    },
                    Some(availability.id),
                )
                .await;
        }
        let assignment_models: Vec<<assignment::Entity as sea_orm::EntityTrait>::Model> =
            Assignment::find().all(s.db()).await.unwrap();
        for a in assignment_models {
            self.vehicles[id_to_vec_pos(a.vehicle)]
                .assignments
                .push(AssignmentData {
                    arrival: a.arrival,
                    departure: a.departure,
                    id: a.id,
                    vehicle: a.vehicle,
                    events: Vec::new(),
                });
        }
        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> =
            Event::find().all(s.db()).await.unwrap();
        for e in event_models {
            for v in self.vehicles.iter_mut() {
                for a in v.assignments.iter_mut() {
                    if a.id == e.chain_id {
                        a.events.push(EventData::from(
                            e.id,
                            e.latitude,
                            e.longitude,
                            e.scheduled_time,
                            e.communicated_time,
                            e.customer,
                            e.chain_id,
                            e.required_vehicle_specifics,
                            e.request_id,
                            e.is_pickup,
                        ));
                    }
                }
            }
        }
        let user_models = User::find().all(s.db()).await.unwrap();
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
        let vehicle_specifics_models = VehicleSpecifics::find().all(s.db()).await.unwrap();
        for vs_m in vehicle_specifics_models.iter() {
            self.vehicle_specifics.push(VehicleSpecificsData {
                seats: vs_m.seats,
                wheelchairs: vs_m.wheelchairs,
                storage_space: vs_m.storage_space,
                id: vs_m.id,
            })
        }
        self.last_request_id = match self
            .vehicles
            .iter()
            .flat_map(|v| &v.assignments)
            .collect_vec()
            .iter()
            .flat_map(|a| &a.events)
            .collect_vec()
            .iter()
            .max_by_key(|e| e.request_id)
        {
            None => 1,
            Some(ev) => ev.request_id,
        };
    }

    async fn find_or_create_vehicle_specs(
        &mut self,
        State(s): State<AppState>,
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
        self.internal_create_vehicle_specifics(State(s), seats, wheelchairs, storage_space)
            .await
    }

    pub async fn create_user(
        &mut self,
        State(s): State<AppState>,
        name: String,
        is_driver: bool,
        is_admin: bool,
        email: String,
        password: Option<String>,
        salt: String,
        o_auth_id: Option<String>,
        o_auth_provider: Option<String>,
    ) -> StatusCode {
        let active_m = user::ActiveModel {
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
        };
        let result = User::insert(active_m.clone()).exec(s.db()).await;
        match result {
            Ok(_) => {
                let id = result.unwrap().last_insert_id;
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
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub async fn create_vehicle(
        &mut self,
        State(s): State<AppState>,
        license_plate: String,
        company: i32,
    ) -> StatusCode {
        //check whether the vehicle fits one of the existing vehicle_specs, otherwise create a new one
        let specs_id = self
            .find_or_create_vehicle_specs(
                State(s.clone()),
                /*post_request.seats,
                post_request.wheelchairs,
                post_request.storage_space, */
                3,
                0,
                0,
            )
            .await;
        let result = Vehicle::insert(vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            active: ActiveValue::Set(false),
            company: ActiveValue::Set(company),
            license_plate: ActiveValue::Set(license_plate.to_string()),
            specifics: ActiveValue::Set(specs_id),
        })
        .exec(s.db())
        .await;
        match result {
            Ok(_) => {
                self.vehicles.push(VehicleData {
                    id: result.unwrap().last_insert_id,
                    license_plate,
                    company,
                    specifics: specs_id,
                    active: false,
                    availability: Vec::new(),
                    assignments: Vec::new(),
                });
                StatusCode::CREATED
            }
            Err(e) => {
                println!("Error creating vehicle  {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    pub async fn create_availability(
        &mut self,
        State(s): State<AppState>,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle: i32,
    ) -> StatusCode {
        self.vehicles[id_to_vec_pos(vehicle)]
            .add_availability(
                State(s.clone()),
                &mut Interval {
                    start_time,
                    end_time,
                },
                None,
            )
            .await;
        StatusCode::CREATED
    }

    async fn internal_create_vehicle_specifics(
        &mut self,
        State(s): State<AppState>,
        seats: i32,
        wheelchairs: i32,
        storage_space: i32,
    ) -> i32 {
        let active_m = vehicle_specifics::ActiveModel {
            id: ActiveValue::NotSet,
            seats: ActiveValue::Set(seats),
            wheelchairs: ActiveValue::Set(wheelchairs),
            storage_space: ActiveValue::Set(storage_space),
        };
        let result = VehicleSpecifics::insert(active_m.clone())
            .exec(s.db())
            .await;

        match result {
            Ok(_) => {
                let last_insert_id = result.unwrap().last_insert_id;
                self.vehicle_specifics.push(VehicleSpecificsData {
                    id: last_insert_id,
                    seats,
                    wheelchairs,
                    storage_space,
                });
                last_insert_id
            }
            Err(e) => {
                error!("Error creating vehicle specifics: {e:?}");
                return -1;
            }
        }
    }

    pub async fn create_zone(
        &mut self,
        State(s): State<AppState>,
        name: String,
        area: String,
    ) -> StatusCode {
        let result = Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            name: ActiveValue::Set(name.to_string()),
            area: ActiveValue::Set(area.to_string()),
        })
        .exec(s.db())
        .await;
        match result {
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Ok(_) => match multi_polygon_from_str(&area) {
                Err(e) => {
                    error!("{e:?}");
                    StatusCode::BAD_REQUEST
                }
                Ok(mp) => {
                    self.zones.push(ZoneData {
                        id: result.unwrap().last_insert_id,
                        area: mp,
                        name,
                    });
                    StatusCode::CREATED
                }
            },
        }
    }

    pub async fn create_company(
        &mut self,
        State(s): State<AppState>,
        name: String,
        zone: i32,
        lat: f32,
        lng: f32,
    ) -> StatusCode {
        let result = Company::insert(company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng),
            latitude: ActiveValue::Set(lat),
            name: ActiveValue::Set(name.to_string()),
            zone: ActiveValue::Set(zone),
        })
        .exec(s.db())
        .await;
        match result {
            Ok(_) => {
                self.companies.push(CompanyData {
                    id: result.unwrap().last_insert_id,
                    central_coordinates: Point::new(lat as f64, lng as f64),
                    zone,
                    name,
                });
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub async fn remove_availability(
        &mut self,
        State(s): State<AppState>,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle_id: i32,
    ) -> StatusCode {
        let mut mark_delete: Vec<usize> = Vec::new();
        let mut to_insert: Option<(Interval, Interval)> = None;
        let to_remove_interval = Interval {
            start_time,
            end_time,
        };
        let vehicle = &mut self.vehicles[id_to_vec_pos(vehicle_id)];
        for (pos, existing) in vehicle.availability.iter_mut().enumerate() {
            if !existing.interval.touches(&to_remove_interval) {
                continue;
            }
            if existing.interval.contains(&to_remove_interval) {
                mark_delete.push(pos);
                to_insert = Some(existing.interval.split(&to_remove_interval));
                break;
            }
            if to_remove_interval.contains(&existing.interval) {
                mark_delete.push(pos);
            }
            if to_remove_interval.overlaps(&existing.interval) {
                existing.interval.cut(&to_remove_interval);
                let mut active_m: availability::ActiveModel = Availability::find_by_id(existing.id)
                    .one(s.clone().db())
                    .await
                    .expect("cannot find availability by id")
                    .expect("")
                    .try_into()
                    .expect("");
                active_m.start_time = ActiveValue::set(existing.interval.start_time);
                active_m.end_time = ActiveValue::set(existing.interval.end_time);
                match Availability::update(active_m).exec(s.clone().db()).await {
                    Ok(_) => (),
                    Err(e) => error!("Error deleting interval: {e:?}"),
                }
            }
        }
        //sort in descending order, to avoid earlier removals affecting indices of later removals
        mark_delete.sort_by(|a, b| b.cmp(a));
        for to_delete in mark_delete {
            match Availability::delete_by_id(vehicle.availability[to_delete].id)
                .exec(s.clone().db())
                .await
            {
                Ok(_) => {
                    vehicle.availability.remove(to_delete);
                }
                Err(e) => error!("Error deleting interval: {e:?}"),
            }
        }
        match to_insert {
            Some((left, right)) => {
                self.create_availability(
                    State(s.clone()),
                    left.start_time,
                    left.end_time,
                    vehicle_id,
                )
                .await;
                self.create_availability(
                    State(s.clone()),
                    right.start_time,
                    right.end_time,
                    vehicle_id,
                )
                .await;
            }
            None => (),
        }
        StatusCode::CREATED
    }

    //TODO: remove pub when events can be created by handling routing requests
    // assignment_id == None <=> assignment already exists
    pub async fn insert_or_add_assignment(
        &mut self,
        assignment_id: Option<i32>,
        departure: NaiveDateTime,
        arrival: NaiveDateTime,
        vehicle: i32,
        State(s): State<AppState>,
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
    ) {
        let id = match assignment_id {
            Some(a_id) => a_id, //assignment already exists
            None => {
                //assignment does not exist, create it in database, which yields the id
                let a_id = match Assignment::insert(assignment::ActiveModel {
                    id: ActiveValue::NotSet,
                    departure: ActiveValue::Set(departure),
                    arrival: ActiveValue::Set(arrival),
                    vehicle: ActiveValue::Set(vehicle),
                })
                .exec(s.db())
                .await
                {
                    Ok(result) => result.last_insert_id,
                    Err(e) => {
                        error!("Error creating assignment: {e:?}");
                        0
                    }
                };
                //now create assignment in self
                (&mut self.vehicles[id_to_vec_pos(vehicle)])
                    .assignments
                    .push(AssignmentData {
                        id: a_id,
                        departure,
                        arrival,
                        vehicle,
                        events: Vec::new(),
                    });
                a_id
            }
        };
        let (start_event_id, target_event_id) = self
            .insert_event_pair_into_db(
                State(s),
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
        let mut ev = vec![
            EventData {
                coordinates: Point::new(lat_start as f64, lng_start as f64),
                scheduled_time: sched_t_start,
                communicated_time: comm_t_start,
                customer: customer,
                assignment: id,
                required_specs: required_vehicle_specs,
                request_id: request_id,
                id: start_event_id,
                is_pickup: true,
            },
            EventData {
                coordinates: Point::new(lat_target as f64, lng_target as f64),
                scheduled_time: sched_t_target,
                communicated_time: comm_t_target,
                customer: customer,
                assignment: id,
                required_specs: required_vehicle_specs,
                request_id: request_id,
                id: target_event_id,
                is_pickup: false,
            },
        ];
        (&mut self.vehicles[id_to_vec_pos(vehicle)])
            .assignments
            .iter_mut()
            .filter(|assignment| assignment.id == id)
            .for_each(|assignment| assignment.events.append(&mut ev));
    }

    async fn insert_event_pair_into_db(
        &mut self,
        State(s): State<AppState>,
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
        let result1 = Event::insert(event::ActiveModel {
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
        .exec(s.db())
        .await;
        match result1 {
            Ok(_) => (),
            Err(e) => {
                error!("Error creating event: {e:?}");
                return (-1, -1);
            }
        }
        let result2 = Event::insert(event::ActiveModel {
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
        .exec(s.db())
        .await;
        match result2 {
            Ok(_) => (
                result1.unwrap().last_insert_id,
                result2.unwrap().last_insert_id,
            ),
            Err(e) => {
                error!("Error creating event: {e:?}");
                return (-1, -1);
            }
        }
    }

    async fn get_companies_matching_start_location(
        &self,
        start: &Point,
    ) -> Vec<bool> {
        let mut viable_zone_ids = Vec::<i32>::new();
        for (pos, zone) in self.zones.iter().enumerate() {
            if zone.area.contains(start) {
                viable_zone_ids.push(vec_pos_to_id(pos));
            }
        }
        let mut viable_companies = Vec::<bool>::new();
        viable_companies.resize(self.companies.len(), false);
        for (pos, company) in self.companies.iter().enumerate() {
            if viable_zone_ids.contains(&(company.zone)) {
                viable_companies[pos] = true;
            }
        }
        viable_companies
    }
    pub async fn handle_routing_request(
        &mut self,
        State(s): State<AppState>,
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
    ) {
        let minimum_prep_time: Duration = Duration::seconds(3600);
        let now: NaiveDateTime = Utc::now().naive_utc();

        let start: Point = Point::new(start_lat as f64, start_lng as f64);

        //find companies, that may process the request according to their zone
        let mut viable_companies = self.get_companies_matching_start_location(&start).await;
        println!("viable companies:");
        for (i, is_viable) in viable_companies.iter().enumerate() {
            if !is_viable {
                continue;
            }
            println!(
                "id: {}, zone id: {}",
                self.companies[i].id, self.companies[i].zone
            );
        }

        println!("viable companies after checking there is a vehicle available:");
        for (i, is_viable) in viable_companies.iter().enumerate() {
            if !is_viable {
                continue;
            }
            println!(
                "id: {}, zone id: {}",
                self.companies[i].id, self.companies[i].zone
            );
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
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            start_many.push(Coordinate {
                lat: c.central_coordinates.y(),
                lng: c.central_coordinates.x(),
            });
        }
        start_many.push(Coordinate {
            lat: target_c.lat,
            lng: target_c.lng,
        });
        // add this to get distance between start and target of the new request
        for sm in start_many.iter() {
            println!("start manys: {}   -   {}", sm.lat, sm.lng);
        }
        let osrm = OSRM::new();
        println!("start: {};; {}", start_c.lat, start_c.lng);
        println!("target: {};; {}", target_c.lat, target_c.lng);
        let mut distances_to_start: Vec<DistTime> =
            match osrm.one_to_many(start_c, start_many).await {
                Ok(r) => r,
                Err(e) => {
                    println!("problem with osrm: {}", e);
                    Vec::new()
                }
            };
        println!("result: {distances_to_start:?}");
        let distance = match distances_to_start.last() {
            Some(dt) => dt,
            None => {
                println!("distance was None");
                &DistTime {
                    time: -1.0,
                    dist: -1.0,
                }
            }
        };
        println!("distance-time--   {}", distance.time);
        println!("distance--   {}", distance.dist);

        let travel_duration = Duration::minutes(seconds_to_minutes(distance.time as i32) as i64);
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
        distances_to_start.truncate(distances_to_start.len() - 1); //remove distance from start to target

        let mut target_many = Vec::<Coordinate>::new();
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            target_many.push(Coordinate {
                lat: c.central_coordinates.y(),
                lng: c.central_coordinates.x(),
            });
        }
        let distances_to_target: Vec<DistTime> =
            osrm.one_to_many(target_c, target_many).await.unwrap();
        let n_viable_companies = viable_companies.iter().filter(|b| **b).count();
        for b in viable_companies.iter() {
            println!("b:{}", b);
        }
        println!("n_viable_companies: {}", n_viable_companies);

        //create all viable combinations
        let mut viable_combinations: Vec<Comb> = Vec::new();
        let mut company_pos = 0;
        for (i, _) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            println!("hallo");
            let company_start_cost =
                seconds_to_minutes(distances_to_start[company_pos].time as i32) * MINUTE_PRICE
                    + meter_to_km(distances_to_start[company_pos].dist as i32) * KM_PRICE;
            let company_target_cost =
                seconds_to_minutes(distances_to_target[company_pos].time as i32) * MINUTE_PRICE
                    + meter_to_km(distances_to_target[company_pos].dist as i32) * KM_PRICE;
            viable_combinations.push(Comb {
                is_start_company: true,
                start_pos: i,
                is_target_company: true,
                target_pos: i,
                cost: company_start_cost + company_target_cost,
            });
            println!("company: {}, start_dist: {}, target_dist: {}, start_time: {}, target_time: {}, start_cost: {}, target_cost: {}",
            company_pos+1,meter_to_km(distances_to_start[company_pos].dist as i32),meter_to_km(distances_to_target[company_pos].dist as i32),
            seconds_to_minutes(distances_to_start[company_pos].time as i32),seconds_to_minutes(distances_to_target[company_pos].time as i32),company_start_cost,company_target_cost);
            company_pos += 1;
        }
        println!("n comb: {}", viable_combinations.len());
        for vc in viable_combinations.iter() {
            println!(
                "cost: {} for company: {}",
                vc.cost, self.companies[vc.start_pos].id,
            );
        }

        if viable_combinations.is_empty() {
            println!("no viable combinations!");
            return;
        }
        println!("viable combination count: {}", viable_combinations.len());

        //use cost function to sort the viable combinations
        viable_combinations.sort_by(|a, b| a.cost.cmp(&(b.cost)));

        if viable_combinations.len() == 0 {
            //TODO
        }
        self.last_request_id += 1;
        self.insert_or_add_assignment(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            1,
            State(s),
            start_address,
            target_address,
            start_lat as f32,
            start_lng as f32,
            start_time,
            start_time,
            customer,
            1,
            self.last_request_id,
            false,
            false,
            target_lat as f32,
            target_lng as f32,
            target_time,
            target_time,
        )
        .await;
    }
    /*
    //does not work yet
    pub async fn handle_routing_request(
        &mut self,
        State(s): State<AppState>,
        fixed_time: NaiveDateTime,
        is_start_time_fixed: bool,
        start_lat: f32,
        start_lng: f32,
        target_lat: f32,
        target_lng: f32,
        customer: i32,
        passengers: i32,
        //wheelchairs: i32, luggage: i32,
    ) {
        let minimum_prep_time: Duration = Duration::seconds(3600);
        let now: NaiveDateTime = Utc::now().naive_utc();

        let sc = Coord {
            x: start_lat as f64,
            y: start_lng as f64,
        };
        let start: Point = sc.into();
        let tc = Coord {
            x: target_lat as f64,
            y: target_lng as f64,
        };
        let target: Point = tc.into();

        let beeline_time: Duration =
            Duration::minutes((start.geodesic_distance(&target)).round() as i64 / AIR_DIST_SPEED);

        let mut start_time: NaiveDateTime = if is_start_time_fixed {
            fixed_time
        } else {
            fixed_time - beeline_time
        };
        let mut target_time: NaiveDateTime = if is_start_time_fixed {
            fixed_time + beeline_time
        } else {
            fixed_time
        };

        if now + minimum_prep_time < start_time {
            //TODO: reject request (companies require more time to prepare..)
        }

        //find companies, that may process the request according to their zone
        let mut viable_companies = self.get_companies_matching_start_location(&start).await;
        println!("viable companies:");
        for (i, is_viable) in viable_companies.iter().enumerate() {
            if !is_viable {
                continue;
            }
            println!(
                "id: {}, zone id: {}",
                self.companies[i].id, self.companies[i].zone
            );
        }

        let mut start_viable_events: Vec<EventData> = Vec::new();
        let mut target_viable_events: Vec<EventData> = Vec::new();

        //For the minimum viable product:
        //The new events can only be linked to the first and last events of each chain of events.
        //This will change once the restriction on creating and expanding event-chains is lifted (TODO)

        /*
        fn check_event_validity(
            scheduled_time: NaiveDateTime,
            beeline_approach_time: Duration,
            beeline_return_time: Duration,
            start_time: NaiveDateTime,
            target_time: NaiveDateTime,
            start_validty: &mut Vec<bool>,
            target_validty: &mut Vec<bool>,
            pos: usize,
            is_pickup: bool,
        ) {
            //check whether an event can be connected in a chain to the new request based on the beeline_time
            if is_pickup && scheduled_time + beeline_approach_time < start_time {
                start_validty[pos] = true;
            }
            if is_pickup && scheduled_time - beeline_return_time > target_time {
                target_validty[pos] = true;
            }
        }
        */

        //Find events valid for start and target based on beeline distances:
        for vehicle in self.vehicles.iter() {
            if !viable_companies[id_to_vec_pos(vehicle.company)]
                || self.vehicle_specifics[id_to_vec_pos(vehicle.specifics)].seats < passengers
                || self.vehicle_specifics[id_to_vec_pos(vehicle.specifics)].wheelchairs < 0
                || self.vehicle_specifics[id_to_vec_pos(vehicle.specifics)].storage_space < 0
            {
                continue;
            }
            let assignments = &vehicle.assignments;
            let new_event_min_time_frame = Interval {
                start_time,
                end_time: target_time,
            };

            //check whether the vehicle has existing assignments overlapping the new event (early exit)
            let overlapping_assignments_iter = vehicle.assignments.iter().filter(|a| {
                new_event_min_time_frame.contains_point(&a.departure)
                    || new_event_min_time_frame.contains_point(&a.arrival)
            });
            if overlapping_assignments_iter.count() >= 2 {
                continue;
            }
            if vehicle
                .assignments
                .iter()
                .filter(|a| {
                    new_event_min_time_frame.contains_point(&a.departure)
                        || new_event_min_time_frame.contains_point(&a.arrival)
                })
                .count()
                == 1
            {
                //TODO: only the overlapping assignment has to be checked
            }
            //look for assignments to which the new event may be appended at the end
            assignments
                .iter()
                .filter(|assignment| {
                    assignment.arrival < start_time && !assignment.events.is_empty()
                })
                .map(|assignment| {
                    assignment
                        .events
                        .iter()
                        .max_by_key(|event| event.scheduled_time)
                        .unwrap()
                })
                .for_each(|event| {
                    let beeline_approach_time: Duration = Duration::minutes(
                        (event.coordinates.geodesic_distance(&start)).round() as i64
                            / AIR_DIST_SPEED,
                    );
                    if event.scheduled_time + beeline_approach_time < start_time {
                        start_viable_events.push(event.clone());
                    }
                });
            //look for assignments to which the new event may be appended at the start
            assignments
                .iter()
                .filter(|a| a.departure > target_time && !a.events.is_empty())
                .map(|a| a.events.iter().min_by_key(|e| e.scheduled_time).unwrap())
                .for_each(|e| {
                    let beeline_return_time: Duration = Duration::minutes(
                        (e.coordinates.geodesic_distance(&target)).round() as i64 / AIR_DIST_SPEED,
                    );
                    if target_time + beeline_return_time < e.scheduled_time {
                        target_viable_events.push(e.clone());
                    }
                });
        }

        println!("start viable events:");
        for ev in start_viable_events.iter() {
            println!("event id: {}", ev.id);
        }
        println!("target viable events:");
        for ev in target_viable_events.iter() {
            println!("event id: {}", ev.id);
        }

        //for all viable companies, ensure that there is a vehicle that is a valid choice to process the new request
        for (i, _) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            if !self.vehicles.iter().any(|v| {
                id_to_vec_pos(v.company) == i
                    && self.vehicle_specifics[id_to_vec_pos(v.specifics)].seats >= passengers
                    && v.find_collisions(start_time, target_time).is_empty()
                    && v.is_available(start_time, target_time)
            }) {
                viable_companies[i] = false;
                continue;
            }
        }

        println!("viable companies after checking there is a vehicle available:");
        for (i, is_viable) in viable_companies.iter().enumerate() {
            if !is_viable {
                continue;
            }
            println!(
                "id: {}, zone id: {}",
                self.companies[i].id, self.companies[i].zone
            );
        }
        //get the actual costs
        let start_c = Coordinate {
            lat: start_lat as f64,
            lng: start_lat as f64,
        };
        let target_c = Coordinate {
            lat: target_lat as f64,
            lng: target_lng as f64,
        };
        let mut start_many = Vec::<Coordinate>::new();
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            start_many.push(Coordinate {
                lat: c.central_coordinates.x(),
                lng: c.central_coordinates.y(),
            });
        }
        for ev in start_viable_events.iter() {
            start_many.push(Coordinate {
                lat: ev.coordinates.x(),
                lng: ev.coordinates.y(),
            });
        }
        start_many.push(Coordinate {
            lat: target.x(),
            lng: target.y(),
        }); // add this to get distance between start and target of the new request
        let osrm = OSRM::new();
        let mut distances_to_start: Vec<DistTime> =
            osrm.one_to_many(start_c, start_many).await.unwrap();
        let distance = distances_to_start.last().unwrap();

        //update start/target times using actual travel time instead of beeline-time
        start_time = if is_start_time_fixed {
            fixed_time
        } else {
            fixed_time - Duration::minutes(distance.time as i64)
        };
        target_time = if is_start_time_fixed {
            fixed_time + Duration::minutes(distance.time as i64)
        } else {
            fixed_time
        };
        distances_to_start.truncate(1); //remove distance from start to target

        let mut target_many = Vec::<Coordinate>::new();
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            target_many.push(Coordinate {
                lat: c.central_coordinates.x(),
                lng: c.central_coordinates.y(),
            });
        }
        for ev in target_viable_events.iter() {
            target_many.push(Coordinate {
                lat: ev.coordinates.x(),
                lng: ev.coordinates.y(),
            });
        }
        let distances_to_target: Vec<DistTime> =
            osrm.one_to_many(target_c, target_many).await.unwrap();

        //check wether viable companies and events become not viable if using actual driving time instead of beeline based approach times TODO

        fn event_cost(
            is_start: bool,
            t: NaiveDateTime,
            distance: &DistTime,
            scheduled_time: NaiveDateTime,
        ) -> i64 {
            (if is_start { -1 } else { 1 }) as i64
                * (t - scheduled_time).num_minutes() as i64
                * MINUTE_PRICE as i64
                + distance.dist as i64 * KM_PRICE as i64
        }
        fn company_cost(distance: &DistTime) -> i64 {
            distance.dist as i64 * KM_PRICE as i64 + distance.time as i64 * MINUTE_PRICE as i64
        }

        let n_viable_companies = viable_companies.iter().filter(|b| **b).count();
        println!("n_viable_companies: {}", n_viable_companies);

        //compute event costs
        let mut start_event_costs = Vec::<i32>::new();
        start_event_costs.resize(start_viable_events.len(), 0);
        let mut target_event_costs = Vec::<i32>::new();
        target_event_costs.resize(target_viable_events.len(), 0);
        for (i, e) in start_viable_events.iter().enumerate() {
            let approach_driving_time = distances_to_start[n_viable_companies + i].time;
            start_event_costs[i] =
                (start_time - e.scheduled_time - Duration::minutes(approach_driving_time as i64))
                    .num_minutes() as i32
                    * MINUTE_WAITING_PRICE
                    + approach_driving_time as i32 * MINUTE_PRICE
                    + distances_to_start[n_viable_companies + i].dist as i32 * KM_PRICE;
        }
        for (i, e) in target_viable_events.iter().enumerate() {
            let approach_driving_time = distances_to_target[n_viable_companies + i].time;
            target_event_costs[i] =
                (target_time - e.scheduled_time - Duration::minutes(approach_driving_time as i64))
                    .num_minutes() as i32
                    * MINUTE_WAITING_PRICE
                    + approach_driving_time as i32 * MINUTE_PRICE
                    + distances_to_target[n_viable_companies + i].dist as i32 * KM_PRICE;
        }
        //create all viable combinations
        let mut viable_combinations: Vec<Comb> = Vec::new();
        let mut company_pos = 0;
        for (i, _) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            let company_start_cost = distances_to_start[company_pos].time as i32 * MINUTE_PRICE
                + distances_to_start[company_pos].dist as i32 * KM_PRICE;
            let company_target_cost = (distances_to_target[company_pos].time as i32 * MINUTE_PRICE
                + distances_to_target[company_pos].dist as i32 * KM_PRICE);
            viable_combinations.push(Comb {
                is_start_company: true,
                start_pos: i,
                is_target_company: true,
                target_pos: i,
                cost: company_start_cost + company_target_cost,
            });
            for (j, e) in start_viable_events.iter().enumerate() {
                if id_to_vec_pos(e.company) != i {
                    continue;
                }
                viable_combinations.push(Comb {
                    is_start_company: false,
                    start_pos: id_to_vec_pos(e.assignment),
                    is_target_company: true,
                    target_pos: i,
                    cost: start_event_costs[j] + company_target_cost,
                })
            }
            for (j, e) in target_viable_events.iter().enumerate() {
                if id_to_vec_pos(e.company) != i {
                    continue;
                }
                viable_combinations.push(Comb {
                    is_start_company: true,
                    start_pos: i,
                    is_target_company: false,
                    target_pos: id_to_vec_pos(e.assignment),
                    cost: company_start_cost + target_event_costs[j],
                })
            }
            company_pos += 1;
        }
        for (i, start) in start_viable_events.iter().enumerate() {
            for (j, target) in target_viable_events.iter().enumerate() {
                if start.company != target.company {
                    continue;
                }
                viable_combinations.push(Comb {
                    is_start_company: false,
                    start_pos: id_to_vec_pos(start.assignment),
                    is_target_company: false,
                    target_pos: id_to_vec_pos(target.assignment),
                    cost: start_event_costs[i] + target_event_costs[j],
                })
            }
        }

        if viable_combinations.is_empty() {
            println!("no viable combinations!");
            return;
        }

        //use cost function to sort the viable combinations
        viable_combinations.sort_by(|a, b| a.cost.cmp(&(b.cost)));

        if viable_combinations.len() == 0 {
            //TODO
        }
        let best_combination = &viable_combinations[0];
        let assignment_pos: Option<usize> = if !best_combination.is_start_company {
            Some(best_combination.start_pos)
        } else if !best_combination.is_target_company {
            Some(best_combination.target_pos)
        } else {
            None
        };
        let company_pos = if best_combination.is_start_company {
            best_combination.start_pos
        } else if best_combination.is_target_company {
            best_combination.target_pos
        } else {
            id_to_vec_pos(
                self.vehicles
                    .iter()
                    .find(|v| {
                        v.assignments
                            .iter()
                            .any(|a| a.id == best_combination.start_pos as i32)
                    })
                    .unwrap()
                    .company,
            )
        };

        self.insert_event_pair_into_db(
            State(s.clone()),
            &"".to_string(),
            &"".to_string(),
            start_lng,
            start_lat,
            start_time,
            start_time,
            vec_pos_to_id(company_pos),
            customer,
            vec_pos_to_id(assignment_pos.unwrap()),
            1,
            1000,
            false,
            false,
            target_lng,
            target_lat,
            target_time,
            target_time,
        )
        .await;
    } */

    pub async fn get_assignments_for_vehicle(
        &self,
        vehicle_id: i32,
        time_frame_start: Option<NaiveDateTime>,
        time_frame_end: Option<NaiveDateTime>,
    ) -> Vec<&AssignmentData> {
        let interval = InfiniteInterval {
            time_frame_start,
            time_frame_end,
        };
        if self.vehicles.len() < id_to_vec_pos(vehicle_id) {
            return Vec::new();
        }
        self.vehicles[id_to_vec_pos(vehicle_id)]
            .assignments
            .iter()
            .filter(|a| interval.contained_in_time_frame(a.departure, a.arrival))
            .collect_vec()
    }

    pub fn get_vehicles(
        &self,
        company_id: i32,
        active: Option<bool>,
    ) -> HashMap<i32, Vec<&VehicleData>> {
        self.vehicles
            .iter()
            .filter(|v| {
                v.company == company_id
                    && match active {
                        Some(a) => a == v.active,
                        None => true,
                    }
            })
            .into_group_map_by(|v| v.specifics)
    }

    pub async fn get_events_for_user(
        &self,
        user_id: i32,
        time_frame_start: Option<NaiveDateTime>,
        time_frame_end: Option<NaiveDateTime>,
    ) -> Vec<&EventData> {
        let interval = InfiniteInterval {
            time_frame_start,
            time_frame_end,
        };
        let mut ret = Vec::<&EventData>::new();
        let customer_id = user_id;
        for v in self.vehicles.iter() {
            for a in v.assignments.iter() {
                for e in a.events.iter() {
                    if e.customer == customer_id
                        && interval.contained_in_time_frame(e.scheduled_time, e.scheduled_time)
                    {
                        ret.push(&e);
                    }
                }
            }
        }
        ret
    }

    //does not work yet
    pub async fn change_vehicle_for_assignment(
        &mut self,
        State(s): State<AppState>,
        assignment_id: i32,
        new_vehicle_id: i32,
    ) -> StatusCode {
        let vehicles = &mut self.vehicles;
        let old_vehicle_id_vec: Vec<i32> = vehicles
            .iter()
            .filter(|vehicle| {
                vehicle
                    .assignments
                    .iter()
                    .any(|assignment| assignment.id == assignment_id)
            })
            .map(|vehicle| vehicle.id)
            .collect();
        if old_vehicle_id_vec.is_empty() {
            return StatusCode::NOT_FOUND;
        }
        if old_vehicle_id_vec.len() > 1 {
            error!("bad backend state: one assignment assigned to multiple cars");
            //TODO
        }
        let old_vehicle_id = old_vehicle_id_vec[0];
        let to_move_pos = vehicles[id_to_vec_pos(old_vehicle_id)]
            .assignments
            .iter()
            .enumerate()
            .filter(|(_pos, a)| a.id == assignment_id)
            .map(|(pos, _)| pos)
            .collect::<Vec<usize>>()[0];

        let mut assignment_to_move: AssignmentData = AssignmentData::new();
        vehicles
            .iter_mut()
            .filter(|vehicle| {
                vehicle
                    .assignments
                    .iter()
                    .any(|assignment| assignment.id == assignment_id)
            })
            .for_each(|vehicle| assignment_to_move = vehicle.assignments.swap_remove(to_move_pos));

        if vehicles[id_to_vec_pos(new_vehicle_id)].company
            != vehicles[id_to_vec_pos(old_vehicle_id)].company
        {
            //TODO: change companies for moving assignment and associated events
        }
        assignment_to_move.vehicle = new_vehicle_id;
        vehicles[id_to_vec_pos(new_vehicle_id)]
            .assignments
            .push(assignment_to_move.clone());

        let model: Option<assignment::Model> = Assignment::find_by_id(assignment_to_move.id)
            .one(s.db())
            .await
            .unwrap();
        let mut active_m: assignment::ActiveModel = model.unwrap().into();
        active_m.vehicle = ActiveValue::Set(new_vehicle_id);
        match active_m.update(s.db()).await {
            Ok(_) => (),
            Err(e) => error!("{}", e),
        }
        StatusCode::ACCEPTED
    }

    //return vectors of conflicting assignments by vehicle ids as keys
    pub async fn get_company_conflicts_for_assignment(
        &self,
        company_id: i32,
        assignment_id: i32,
    ) -> HashMap<i32, Vec<&AssignmentData>> {
        let mut interval = Interval {
            start_time: NaiveDateTime::MIN,
            end_time: NaiveDateTime::MAX,
        };
        let mut found_company = false;
        let mut found_assignment = false;
        for vehicle in self.vehicles.iter() {
            if company_id != vehicle.company {
                continue;
            }
            found_company = true;
            for assignment in vehicle.assignments.iter() {
                if assignment.id != assignment_id {
                    continue;
                }
                found_assignment = true;
                interval.start_time = assignment.departure;
                interval.end_time = assignment.arrival;
            }
        }
        let mut ret = HashMap::<i32, Vec<&AssignmentData>>::new();
        if !found_company {
            error!("invalid company-id: {}", company_id);
            return ret;
        }
        if !found_assignment {
            error!("invalid assignment-id: {}", assignment_id);
            return ret;
        }
        for v in self.vehicles.iter() {
            if v.company != company_id {
                continue;
            }
            let conflicting_assignments = v
                .assignments
                .iter()
                .filter(|a| {
                    interval.touches(&Interval {
                        start_time: a.departure,
                        end_time: a.arrival,
                    })
                })
                .collect_vec();
            if !conflicting_assignments.is_empty() {
                ret.insert(v.id, conflicting_assignments);
            }
        }
        ret
    }

    #[allow(dead_code)]
    pub async fn get_vehicle_conflicts_for_assignment(
        &self,
        vehicle_id: i32,
        assignment_id: i32,
    ) -> Vec<&AssignmentData> {
        let mut interval = Interval {
            start_time: NaiveDateTime::MIN,
            end_time: NaiveDateTime::MAX,
        };
        let mut found = false;
        for v in self.vehicles.iter() {
            for a in v.assignments.iter() {
                if a.id != assignment_id {
                    continue;
                }
                found = true;
                interval.start_time = a.departure;
                interval.end_time = a.arrival;
            }
        }
        if !found {
            return Vec::new();
        }
        self.vehicles[id_to_vec_pos(vehicle_id)]
            .assignments
            .iter()
            .filter(|a| {
                interval.touches(&Interval {
                    start_time: a.departure,
                    end_time: a.arrival,
                })
            })
            .collect_vec()
    }
}

#[cfg(test)]
mod test {
    use crate::{
        be::{
            backend::Data,
            geo_from_str::{self, point_from_str},
        },
        constants::geo_points::{
            self, TestPoints, P1_BAUTZEN_OST, P1_BAUTZEN_WEST, P1_GORLITZ, P1_OUTSIDE, P2_OUTSIDE,
            P3_OUTSIDE,
        },
        dotenv, env, init,
        init::StopFor::TEST1,
        AppState, Arc, Database, Migrator, Mutex, Tera,
    };
    use axum::extract::State;
    use chrono::{NaiveDate, NaiveDateTime, Timelike};
    use geo::{Contains, Point};
    use migration::MigratorTrait;

    use super::ZoneData;

    fn check_zones(
        d: &Data,
        containing_companies: Vec<bool>,
        expected_zone: i32,
    ) {
        for (i, contains) in containing_companies.iter().enumerate() {
            if *contains {
                assert_eq!(d.companies[i].zone, expected_zone);
            } else {
                assert_ne!(d.companies[i].zone, expected_zone);
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
        State(s): State<AppState>,
        data: &Data,
        read_data: &mut Data,
    ) {
        read_data.clear();
        read_data.read_data(State(s.clone())).await;
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
        let s = AppState {
            tera,
            db: Arc::new(conn),
        };

        let mut d = init::init(State(s.clone()), true, TEST1).await;
        assert_eq!(d.vehicles.len(), 29);
        assert_eq!(d.zones.len(), 3);
        assert_eq!(d.companies.len(), 8);

        let mut read_data = Data::new();
        check_data_db_synchronized(State(s.clone()), &d, &mut read_data).await;

        let test_points = TestPoints::new();

        let p_in_bautzen_ost = test_points.bautzen_ost[0];
        let p_in_bautzen_west = test_points.bautzen_west[0];
        let p_in_gorlitz = test_points.gorlitz[0];
        let p1_outside = test_points.outside[0];
        let p2_outside = test_points.outside[1];
        let p3_outside = test_points.outside[2];
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

        check_zones(
            &d,
            d.get_companies_matching_start_location(&p_in_bautzen_ost)
                .await,
            1,
        );
        check_zones(
            &d,
            d.get_companies_matching_start_location(&p_in_bautzen_west)
                .await,
            2,
        );
        check_zones(
            &d,
            d.get_companies_matching_start_location(&p_in_gorlitz).await,
            3,
        );
        check_zones(
            &d,
            d.get_companies_matching_start_location(&p1_outside).await,
            -1,
        );
        check_zones(
            &d,
            d.get_companies_matching_start_location(&p2_outside).await,
            -1,
        );

        //remove_availability and create_availability_____________________________________________________________________________________________________________________________________________
        assert_eq!(d.vehicles[0].availability.len(), 1);
        d.create_availability(
            State(s.clone()),
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
            State(s.clone()),
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
            State(s.clone()),
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
            State(s.clone()),
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
            State(s.clone()),
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
            State(s.clone()),
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
        assert_eq!(d.vehicles[0].availability[0].interval.start_time.hour(), 10);
        assert_eq!(
            d.vehicles[0].availability[0].interval.start_time.minute(),
            10
        );

        d.remove_availability(
            State(s.clone()),
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
        assert_eq!(d.vehicles[0].availability[0].interval.start_time.hour(), 11);
        assert_eq!(
            d.vehicles[0].availability[0].interval.start_time.minute(),
            0
        );

        //get_company_conflicts_for_assignment_____________________________________________________________________________________________________________________________________________
        for company in d.companies.iter() {
            for (v, assignments) in d
                .get_company_conflicts_for_assignment(company.id, 1)
                .await
                .iter()
            {
                assert_eq!(company.id, 1);
                assert_eq!(assignments.len() == 0, *v != 2);
            }
        }

        //get_events_for_user_____________________________________________________________________________________________________________________________________________
        for (user_id, _) in d.users.iter() {
            assert_eq!(
                d.get_events_for_user(*user_id, None, None).await.is_empty(),
                *user_id != 2
            );
        }

        //get_vehicles_____________________________________________________________________________________________________________________________________________
        for company in d.companies.iter() {
            let vehicles = d.get_vehicles(company.id, None);
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

        check_data_db_synchronized(State(s.clone()), &d, &mut read_data).await;

        d.handle_routing_request(
            State(s.clone()),
            NaiveDateTime::MIN,
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

        check_data_db_synchronized(State(s.clone()), &d, &mut read_data).await;
    }
}
