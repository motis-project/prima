use crate::be::interval::Interval;
use crate::constants::constants::*;
use crate::entities::prelude::*;
use crate::entities::{self, availability};
use crate::entities::{assignment, company, event, user, vehicle, vehicle_specifics, zone};

use crate::osrm::Coordinate;
use crate::osrm::{DistTime, OSRM};

use crate::{error, info, AppState, State, StatusCode};
use axum::response::Html;
use axum::Json;
use chrono::{DateTime, Datelike, Duration, NaiveTime, Utc};
use chrono::{NaiveDate, NaiveDateTime};
use geo::prelude::*;
use geo::{Coord, Point};
use geojson::{GeoJson, Geometry};
use itertools::Itertools;
use migration::Mode;
use sea_orm::TryIntoModel;
use sea_orm::{ActiveValue, DeleteResult, EntityTrait};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct CreateCompany {
    pub lat: f32,
    pub lng: f32,
    pub zone: i32,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateZone {
    pub area: String,
    pub name: String,
}

#[derive(Deserialize)]
pub struct CreateVehicleAvailability {
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
    pub vehicle: i32,
}

#[derive(Deserialize)]
pub struct CreateVehicle {
    pub license_plate: String,
    pub company: i32,
    //not needed in mvp
    /*
    pub seats: i32,
    pub wheelchairs: i32,
    pub storage_space: i32, */
}

#[derive(Deserialize)]
pub struct CreateCapacity {
    //not needed in mvp
    //pub seats: i32,
    //pub wheelchairs: i32,
    //pub storage_space: i32,
    pub company: i32,
    pub interval: Interval,
    pub amount: i32,
}

#[derive(Deserialize)]
pub struct RoutingRequest {
    fixed_time: NaiveDateTime,
    is_start_time_fixed: bool,
    start_lat: f32,
    start_lng: f32,
    target_lat: f32,
    target_lng: f32,
    passengers: i32,
    //wheelchairs: i32,
    //luggage: i32,
    customer: i32,
}

#[derive(Deserialize)]
pub struct GetCapacity {
    pub company: i32,
    //not needed in mvp
    //pub vehicle_specs: i32,
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct GetById {
    pub id: usize,
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

impl GetById {
    fn contained_in_time_frame(
        &self,
        start: NaiveDateTime,
        end: NaiveDateTime,
    ) -> bool {
        (match self.time_frame_start {
            None => true,
            Some(t) => start >= t,
        } && match self.time_frame_end {
            None => true,
            Some(t) => end <= t,
        })
    }
}

#[derive(Deserialize)]
pub struct GetBy2Ids {
    pub id1: usize,
    pub id2: usize,
    //pub time_frame_start: Option<NaiveDateTime>,
    //pub time_frame_end: Option<NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct GetVehicleById {
    pub id: usize,
    pub active: Option<bool>,
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

#[derive(Deserialize, PartialEq, Clone)]
pub struct UserData {
    pub id: Option<i32>,
    pub name: String,
    pub is_driver: bool,
    pub is_admin: bool,
    pub email: String,
    pub password: Option<String>,
    pub salt: String,
    pub o_auth_id: Option<String>,
    pub o_auth_provider: Option<String>,
}

//end of pub structs_______________________________________________________________________________________________________________________

struct Comb {
    is_start_company: bool,
    start_id: usize,
    is_target_company: bool,
    target_id: usize,
    cost: i32,
}

struct BestCombination {
    best_start_time_pos: usize,
    best_target_time_pos: usize,
}

//start data structs_______________________________________________________________________________________________________________________
#[derive(Clone, PartialEq)]
struct AssignmentData {
    pub id: usize,
    departure: NaiveDateTime,
    arrival: NaiveDateTime,
    company: usize,
    vehicle: usize,
    events: Vec<EventData>,
}
impl AssignmentData {
    fn new() -> Self {
        Self {
            id: 0,
            departure: NaiveDateTime::MIN,
            arrival: NaiveDateTime::MAX,
            company: 0,
            vehicle: 0,
            events: Vec::new(),
        }
    }
}

#[derive(Eq, PartialEq)]
struct AvailabilityData {
    id: i32,
    interval: Interval,
}

#[derive(PartialEq)]
struct VehicleData {
    id: usize,
    pub license_plate: String,
    pub company: usize,
    pub specifics: usize,
    pub active: bool,
    pub availability: Vec<AvailabilityData>,
    pub assignments: Vec<AssignmentData>,
}

impl VehicleData {
    pub fn print(&self) {
        println!("vehicle availability size: {}", self.availability.len());
    }
}

impl VehicleData {
    async fn add_availability(
        &mut self,
        State(s): State<AppState>,
        new_interval: &mut Interval,
        id: i32,
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
        for to_delete in mark_delete.clone() {
            let result: Result<DeleteResult, migration::DbErr> =
                Availability::delete_by_id(self.availability[to_delete].id as i32)
                    .exec(s.clone().db())
                    .await;
            match result {
                Ok(_) => {
                    self.availability.remove(to_delete);
                    //info!("Interval {} deleted from db",self.availability[to_delete].interval,)
                }
                Err(e) => error!("Error deleting interval: {e:?}"),
            }
        }
        self.availability.push(AvailabilityData {
            id,
            interval: *new_interval,
        });
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
struct EventData {
    coordinates: geo::Point,
    scheduled_time: NaiveDateTime,
    communicated_time: NaiveDateTime,
    customer: usize,
    assignment: usize,
    required_specs: usize,
    request_id: usize,
    pub id: usize,
    is_pickup: bool,
    company: usize,
}
impl EventData {
    fn from(
        id: usize,
        lat: f32,
        lng: f32,
        scheduled_time: NaiveDateTime,
        communicated_time: NaiveDateTime,
        company: usize,
        customer: usize,
        assignment: usize,
        required_specs: usize,
        request_id: usize,
        is_pickup: bool,
    ) -> Self {
        Self {
            coordinates: Point::new(lat as f64, lng as f64),
            id,
            scheduled_time,
            communicated_time,
            company,
            customer,
            assignment,
            request_id,
            required_specs,
            is_pickup,
        }
    }
}

#[derive(PartialEq)]
struct CompanyData {
    id: usize,
    central_coordinates: geo::Point,
    zone: usize,
    name: String,
}
impl CompanyData {
    fn from(
        creator: CreateCompany,
        new_id: i32,
    ) -> Self {
        Self {
            id: new_id as usize,
            zone: creator.zone as usize,
            name: creator.name,
            central_coordinates: Point::new(creator.lat as f64, creator.lng as f64),
        }
    }
}

#[derive(PartialEq)]
struct ZoneData {
    area: geo::MultiPolygon,
    id: usize,
}

#[derive(PartialEq)]
pub struct Data {
    users: Vec<UserData>,
    zones: Vec<ZoneData>,
    companies: Vec<CompanyData>,
    vehicles: Vec<VehicleData>,
    vehicle_specifics: Vec<vehicle_specifics::Model>,
}

impl Data {
    pub fn new() -> Self {
        Self {
            zones: Vec::<ZoneData>::new(),
            companies: Vec::<CompanyData>::new(),
            vehicles: Vec::<VehicleData>::new(),
            vehicle_specifics: Vec::<vehicle_specifics::Model>::new(),
            users: Vec::<UserData>::new(),
        }
    }

    pub fn clear(&mut self) {
        self.users.clear();
        self.companies.clear();
        self.vehicles.clear();
        self.vehicle_specifics.clear();
        self.zones.clear();
    }

    pub fn print(&self) {
        for vehicle in self.vehicles.iter() {
            print!("id: {}, ", vehicle.id);
            vehicle.print();
        }
    }

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
            let geojson = zone.area.parse::<GeoJson>().unwrap();
            let feature: Geometry = Geometry::try_from(geojson).unwrap();
            self.zones.push(ZoneData {
                area: geo::MultiPolygon::try_from(feature).unwrap(),
                id: zone.id as usize,
            });
        }
        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> =
            Company::find().all(s.db()).await.unwrap();
        for company_model in company_models {
            self.companies.push(CompanyData::from(
                CreateCompany {
                    name: company_model.name,
                    zone: company_model.zone,
                    lat: company_model.latitude,
                    lng: company_model.longitude,
                },
                company_model.id,
            ));
        }
        let vehicle_models: Vec<<vehicle::Entity as sea_orm::EntityTrait>::Model> =
            Vehicle::find().all(s.db()).await.unwrap();
        for vehicle in vehicle_models.iter() {
            self.vehicles.push(VehicleData {
                id: vehicle.id as usize,
                license_plate: vehicle.license_plate.to_string(),
                company: vehicle.company as usize,
                specifics: vehicle.specifics as usize,
                active: vehicle.active,
                availability: Vec::new(),
                assignments: Vec::new(),
            })
        }
        let availability_models: Vec<<availability::Entity as sea_orm::EntityTrait>::Model> =
            Availability::find().all(s.db()).await.unwrap();

        for availability in availability_models.iter() {
            println!("availability: {}", availability.id);
            self.vehicles[(availability.vehicle - 1) as usize]
                .add_availability(
                    State(s.clone()),
                    &mut Interval {
                        start_time: availability.start_time,
                        end_time: availability.end_time,
                    },
                    availability.id,
                )
                .await;
        }
        let assignment_models: Vec<<assignment::Entity as sea_orm::EntityTrait>::Model> =
            Assignment::find().all(s.db()).await.unwrap();
        for a in assignment_models {
            self.vehicles[(a.id - 1) as usize]
                .assignments
                .push(AssignmentData {
                    arrival: a.arrival,
                    departure: a.departure,
                    id: a.id as usize,
                    company: a.company as usize,
                    vehicle: a.vehicle as usize,
                    events: Vec::new(),
                });
        }
        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> =
            Event::find().all(s.db()).await.unwrap();
        for e in event_models {
            for v in self.vehicles.iter_mut() {
                for a in v.assignments.iter_mut() {
                    if a.id == e.chain_id as usize {
                        a.events.push(EventData::from(
                            e.id as usize,
                            e.latitude,
                            e.longitude,
                            e.scheduled_time,
                            e.communicated_time,
                            e.company as usize,
                            e.customer as usize,
                            e.chain_id as usize,
                            e.required_vehicle_specifics as usize,
                            e.request_id as usize,
                            e.is_pickup,
                        ));
                    }
                }
            }
        }
        let user_models = entities::prelude::User::find().all(s.db()).await.unwrap();
        for user_model in user_models {
            self.users.push(UserData {
                id: Some(user_model.id),
                name: user_model.name,
                is_driver: user_model.is_driver,
                is_admin: user_model.is_admin,
                email: user_model.email,
                password: user_model.password,
                salt: user_model.salt,
                o_auth_id: user_model.o_auth_id,
                o_auth_provider: user_model.o_auth_provider,
            });
        }
        self.vehicle_specifics = VehicleSpecifics::find().all(s.db()).await.unwrap();
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
        Json(post_request): Json<UserData>,
    ) -> StatusCode {
        let mut user = post_request.clone();
        let active_m = user::ActiveModel {
            id: ActiveValue::NotSet,
            name: ActiveValue::Set(post_request.name),
            is_driver: ActiveValue::Set(post_request.is_driver),
            is_admin: ActiveValue::Set(post_request.is_admin),
            email: ActiveValue::Set(post_request.email),
            password: ActiveValue::Set(post_request.password),
            salt: ActiveValue::Set(post_request.salt),
            o_auth_id: ActiveValue::Set(post_request.o_auth_id),
            o_auth_provider: ActiveValue::Set(post_request.o_auth_provider),
            is_active: ActiveValue::Set(true),
        };
        let result = entities::prelude::User::insert(active_m.clone())
            .exec(s.db())
            .await;
        match result {
            Ok(_) => {
                user.id = Some(result.unwrap().last_insert_id);
                self.users.push(user);
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub async fn create_vehicle(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateVehicle>,
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
        let mut active_m = vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            active: ActiveValue::Set(false),
            company: ActiveValue::Set(post_request.company),
            license_plate: ActiveValue::Set(post_request.license_plate.to_string()),
            specifics: ActiveValue::Set(specs_id),
        };
        let result = Vehicle::insert(active_m.clone()).exec(s.db()).await;
        match result {
            Ok(_) => {
                self.vehicles.push(VehicleData {
                    id: result.unwrap().last_insert_id as usize,
                    license_plate: post_request.license_plate,
                    company: post_request.company as usize,
                    specifics: specs_id as usize,
                    active: false,
                    availability: Vec::new(),
                    assignments: Vec::new(),
                });
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub async fn create_availability(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateVehicleAvailability>,
    ) -> StatusCode {
        let active_m = availability::ActiveModel {
            id: ActiveValue::NotSet,
            start_time: ActiveValue::Set(post_request.start_time),
            end_time: ActiveValue::Set(post_request.end_time),
            vehicle: ActiveValue::Set(post_request.vehicle),
        };
        let result = Availability::insert(active_m.clone()).exec(s.db()).await;
        match result {
            Ok(_) => {
                self.vehicles[(post_request.vehicle - 1) as usize]
                    .add_availability(
                        State(s.clone()),
                        &mut Interval {
                            start_time: post_request.start_time,
                            end_time: post_request.end_time,
                        },
                        result.unwrap().last_insert_id,
                    )
                    .await;
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    async fn internal_create_vehicle_specifics(
        &mut self,
        State(s): State<AppState>,
        seats: i32,
        wheelchairs: i32,
        storage_space: i32,
    ) -> i32 {
        let mut active_m = vehicle_specifics::ActiveModel {
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
                let mut last_insert_id = -1;
                last_insert_id = result.unwrap().last_insert_id;
                active_m.id = ActiveValue::Set(last_insert_id);
                self.vehicle_specifics.push(active_m.try_into().unwrap());
                info!("Vehicle specifics with id {} created", last_insert_id);
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
        Json(post_request): Json<CreateZone>,
    ) -> StatusCode {
        let result = Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            area: ActiveValue::Set(post_request.area.to_string()),
            name: ActiveValue::Set(post_request.name.to_string()),
        })
        .exec(s.db())
        .await;
        match result {
            Ok(_) => {
                let geojson = post_request.area.parse::<GeoJson>().unwrap();
                let feature: Geometry = Geometry::try_from(geojson).unwrap();
                self.zones.push(ZoneData {
                    id: result.unwrap().last_insert_id as usize,
                    area: geo::MultiPolygon::try_from(feature).unwrap(),
                });
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    pub async fn create_company(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateCompany>,
    ) -> StatusCode {
        let mut active_m = company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(post_request.lng),
            latitude: ActiveValue::Set(post_request.lat),
            name: ActiveValue::Set(post_request.name.to_string()),
            zone: ActiveValue::Set(post_request.zone),
        };
        let result = Company::insert(active_m.clone()).exec(s.db()).await;
        match result {
            Ok(_) => {
                self.companies.push(CompanyData::from(
                    post_request,
                    result.unwrap().last_insert_id,
                ));
                StatusCode::CREATED
            }
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    //TODO: remove pub when events can be created by handling routing requests
    pub async fn insert_event_pair_into_db(
        &mut self,
        State(s): State<AppState>,
        address: &String,
        lng_start: f32,
        lat_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
        company: i32,
        customer: i32,
        assignment: i32,
        required_vehicle_specs: i32,
        request_id: i32,
        connects_public_transport1: bool,
        connects_public_transport2: bool,
        lng_target: f32,
        lat_target: f32,
        sched_t_target: NaiveDateTime,
        comm_t_target: NaiveDateTime,
    ) {
        let result1 = Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_start),
            latitude: ActiveValue::Set(lat_start),
            scheduled_time: ActiveValue::Set(sched_t_start),
            communicated_time: ActiveValue::Set(comm_t_start),
            company: ActiveValue::set(company),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(assignment),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(true),
            connects_public_transport: ActiveValue::Set(connects_public_transport1),
            address: ActiveValue::Set(address.to_string()),
        })
        .exec(s.db())
        .await;
        match result1 {
            Ok(_) => {
                () //info!("event created");
            }
            Err(e) => {
                error!("Error creating event: {e:?}");
                return;
            }
        }
        let result2 = Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_target),
            latitude: ActiveValue::Set(lat_target),
            scheduled_time: ActiveValue::Set(sched_t_target),
            communicated_time: ActiveValue::Set(comm_t_target),
            company: ActiveValue::set(company),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(assignment),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(false),
            connects_public_transport: ActiveValue::Set(connects_public_transport2),
            address: ActiveValue::Set(address.to_string()),
        })
        .exec(s.db())
        .await;
        match result2 {
            Ok(_) => {
                () //info!("Event created");
            }
            Err(e) => {
                error!("Error creating event: {e:?}");
                return;
            }
        }
    }

    async fn get_companies_matching_start_point(
        &self,
        start: &geo::Point,
    ) -> Vec<bool> {
        let mut viable_zone_ids = Vec::<i32>::new();
        for (pos, z) in self.zones.iter().map(|z| &z.area).enumerate() {
            if z.contains(start) {
                viable_zone_ids.push(pos as i32 + 1);
            }
        }
        let mut viable_companies = Vec::<bool>::new();
        viable_companies.resize(self.companies.len(), false);
        for (pos, c) in self.companies.iter().enumerate() {
            if viable_zone_ids.contains(&(c.zone as i32)) {
                viable_companies[pos] = true;
            }
        }
        viable_companies
    }

    pub async fn handle_routing_request(
        &mut self,
        State(s): State<AppState>,
        Json(request): Json<RoutingRequest>,
    ) {
        let minimum_prep_time: Duration = Duration::seconds(3600);
        let now: NaiveDateTime = Utc::now().naive_utc();

        let sc = Coord {
            x: request.start_lat as f64,
            y: request.start_lng as f64,
        };
        let start: Point = sc.into();
        let tc = Coord {
            x: request.target_lat as f64,
            y: request.target_lng as f64,
        };
        let target: Point = tc.into();

        let beeline_time: Duration =
            Duration::minutes((start.geodesic_distance(&target)).round() as i64 / AIR_DIST_SPEED);

        let mut start_time: NaiveDateTime = if request.is_start_time_fixed {
            request.fixed_time
        } else {
            request.fixed_time - beeline_time
        };
        let mut target_time: NaiveDateTime = if request.is_start_time_fixed {
            request.fixed_time + beeline_time
        } else {
            request.fixed_time
        };

        if now + minimum_prep_time < start_time {
            //TODO: reject request (companies require more time to prepare..)
        }

        //find companies, that may process the request according to their zone
        let mut viable_companies = self.get_companies_matching_start_point(&start).await;

        let mut start_viable_events: Vec<EventData> = Vec::new();
        let mut target_viable_events: Vec<EventData> = Vec::new();

        //For the minimum viable product:
        //The new events can only be linked to the first and last events of each chain of events.
        //This will change once the restriction on creating and expanding event-chains is lifted (TODO)
        let mut group_earliest: Vec<Option<usize>> = Vec::new();
        let mut group_latest: Vec<Option<usize>> = Vec::new();
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
        //Find events valid for start and target based on beeline distances:
        for vehicle in self.vehicles.iter() {
            if !viable_companies[vehicle.company as usize]
                || self.vehicle_specifics[vehicle.specifics as usize].seats < request.passengers
            {
                continue;
            }
            let assignments = &vehicle.assignments;
            let new_event_min_time_frame = Interval {
                start_time: start_time,
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
                .filter(|a| a.arrival < start_time && !a.events.is_empty())
                .map(|a| a.events.iter().max_by_key(|e| e.scheduled_time).unwrap())
                .for_each(|e| {
                    let beeline_approach_time: Duration = Duration::minutes(
                        (e.coordinates.geodesic_distance(&start)).round() as i64 / AIR_DIST_SPEED,
                    );
                    if e.scheduled_time + beeline_approach_time < start_time {
                        start_viable_events.push(e.clone());
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

        //for all viable companies, ensure that there is a vehicle that is a valid choice to process the new request
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            if !self.vehicles.iter().any(|v| {
                v.company as usize == i
                    && self.vehicle_specifics[v.specifics as usize].seats >= request.passengers
                    && v.find_collisions(start_time, target_time).is_empty()
                    && v.is_available(start_time, target_time)
            }) {
                viable_companies[i] = false;
                continue;
            }
        }
        //get the actual costs
        let start_c = Coordinate {
            lat: request.start_lat as f64,
            lng: request.start_lat as f64,
        };
        let target_c = Coordinate {
            lat: request.target_lat as f64,
            lng: request.target_lng as f64,
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
        start_time = if request.is_start_time_fixed {
            request.fixed_time
        } else {
            request.fixed_time - Duration::minutes(distance.time as i64)
        };
        target_time = if request.is_start_time_fixed {
            request.fixed_time + Duration::minutes(distance.time as i64)
        } else {
            request.fixed_time
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

        let n_viable_companies = viable_companies.iter().filter(|b| true).count();

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
        let mut viable_combinations: Vec<(Comb)> = Vec::new();
        let mut company_pos = 0;
        for (i, c) in self.companies.iter().enumerate() {
            if !viable_companies[i] {
                continue;
            }
            let company_start_cost = distances_to_start[company_pos].time as i32 * MINUTE_PRICE
                + distances_to_start[company_pos].dist as i32 * KM_PRICE;
            let company_target_cost = (distances_to_target[company_pos].time as i32 * MINUTE_PRICE
                + distances_to_target[company_pos].dist as i32 * KM_PRICE);
            viable_combinations.push(Comb {
                is_start_company: true,
                start_id: i,
                is_target_company: true,
                target_id: i,
                cost: company_start_cost + company_target_cost,
            });
            for (j, e) in start_viable_events.iter().enumerate() {
                if e.company != i {
                    continue;
                }
                viable_combinations.push(Comb {
                    is_start_company: false,
                    start_id: e.assignment,
                    is_target_company: true,
                    target_id: i,
                    cost: start_event_costs[j] + company_target_cost,
                })
            }
            for (j, e) in target_viable_events.iter().enumerate() {
                if e.company != i {
                    continue;
                }
                viable_combinations.push(Comb {
                    is_start_company: true,
                    start_id: i,
                    is_target_company: false,
                    target_id: e.assignment,
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
                    start_id: start.assignment,
                    is_target_company: false,
                    target_id: target.assignment,
                    cost: start_event_costs[i] + target_event_costs[j],
                })
            }
        }

        //use cost function to sort the viable combinations
        viable_combinations.sort_by(|a, b| a.cost.cmp(&(b.cost)));

        if viable_combinations.len() == 0 {
            //TODO
        }
        let best_combination = &viable_combinations[0];
        let assignment_id: Option<usize> = if !best_combination.is_start_company {
            Some(best_combination.start_id)
        } else if !best_combination.is_target_company {
            Some(best_combination.target_id)
        } else {
            None
        };
        let company_id = if best_combination.is_start_company {
            best_combination.start_id
        } else if best_combination.is_target_company {
            best_combination.target_id
        } else {
            self.vehicles
                .iter()
                .find(|v| {
                    v.assignments
                        .iter()
                        .any(|a| a.id == best_combination.start_id)
                })
                .unwrap()
                .company
        };

        self.insert_event_pair_into_db(
            State(s.clone()),
            &"".to_string(),
            request.start_lng,
            request.start_lat,
            start_time,
            start_time,
            company_id as i32,
            request.customer,
            assignment_id.unwrap() as i32,
            1,
            1000,
            false,
            false,
            request.target_lng,
            request.target_lat,
            target_time,
            target_time,
        )
        .await
    }

    //id->vehicle_id
    pub async fn get_assignments_for_vehicle(
        &self,
        Json(get_request): Json<GetById>,
    ) -> Vec<&AssignmentData> {
        if self.vehicles.len() < get_request.id {
            //error vehicle not found
        }
        self.vehicles[get_request.id]
            .assignments
            .iter()
            .filter(|a| get_request.contained_in_time_frame(a.departure, a.arrival))
            .collect_vec()
    }

    //id->company_id
    pub async fn get_vehicles(
        &self,
        Json(get_request): Json<GetVehicleById>,
    ) -> HashMap<usize, Vec<&VehicleData>> {
        self.vehicles
            .iter()
            .filter(|v| {
                v.company == get_request.id
                    && match get_request.active {
                        Some(a) => a == v.active,
                        None => true,
                    }
            })
            .into_group_map_by(|v| v.specifics)
    }

    //id->user_id
    pub async fn get_events_for_user(
        &self,
        Json(get_request): Json<GetById>,
    ) -> Vec<&EventData> {
        let mut ret = Vec::<&EventData>::new();
        let customer_id = get_request.id;
        for v in self.vehicles.iter() {
            for a in v.assignments.iter() {
                for e in a.events.iter() {
                    if e.customer == customer_id
                        && get_request.contained_in_time_frame(e.scheduled_time, e.scheduled_time)
                    {
                        ret.push(&e);
                    }
                }
            }
        }
        ret
    }

    //ignores time_frame, id1->company_id, id2 assignment id
    pub async fn get_company_conflicts_for_assignment(
        &self,
        Json(get_request): Json<GetBy2Ids>,
    ) -> HashMap<usize, Vec<&AssignmentData>> {
        let mut interval = Interval {
            start_time: NaiveDateTime::MIN,
            end_time: NaiveDateTime::MAX,
        };
        let mut found = false;
        for v in self.vehicles.iter() {
            for a in v.assignments.iter() {
                if a.id != get_request.id2 {
                    continue;
                }
                found = true;
                interval.start_time = a.departure;
                interval.end_time = a.arrival;
            }
        }
        let mut ret = HashMap::<usize, Vec<&AssignmentData>>::new();
        if !found {
            return ret;
        }
        for (i, v) in self.vehicles.iter().enumerate() {
            if v.company != get_request.id1 {
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
            if conflicting_assignments.is_empty() {
                ret.insert(i, conflicting_assignments);
            }
        }
        ret
    }

    //id1->vehicle_id, id2 assignment id
    pub async fn get_vehicle_conflicts_for_assignment(
        &self,
        Json(get_request): Json<GetBy2Ids>,
    ) -> Vec<&AssignmentData> {
        let mut interval = Interval {
            start_time: NaiveDateTime::MIN,
            end_time: NaiveDateTime::MAX,
        };
        let mut found = false;
        for v in self.vehicles.iter() {
            for a in v.assignments.iter() {
                if a.id != get_request.id2 {
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
        self.vehicles[get_request.id1]
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

// #[cfg(test)]
// mod test {
//     use crate::{env, AppState, Arc, Data, Database, Mutex, Tera};
//     use axum::extract::State;
//     use chrono::NaiveDate;

//     #[tokio::test]
//     async fn test() {
//         let tera = match Tera::new("html/*.html") {
//             Ok(t) => Arc::new(Mutex::new(t)),
//             Err(e) => {
//                 println!("Parsing error(s): {}", e);
//                 ::std::process::exit(1);
//             }
//         };
//         let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
//         let conn = Database::connect(db_url)
//             .await
//             .expect("Database connection failed");
//         let s = AppState {
//             tera: tera,
//             db: Arc::new(conn),
//         };
//         let mut data = Data::new();
//         //data.insert_capacity(State(s.clone()), 1, 4, 3, 0, 0,  NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 10, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(14, 30, 0).unwrap()).await;
//         //data.insert_capacity(State(s.clone()), 1, 4, 3, 0, 0,  NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(11, 0, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(18, 00, 0).unwrap()).await;
//     }
// }
