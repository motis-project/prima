
use crate::be::{interval::Interval,capacity::Capacities};
use crate::constants::constants::*;
use crate::entities::{self};
use crate::entities::prelude::*;
use crate::entities::{capacity, company, event, user, vehicle, vehicle_specifics, zone, assignment};

use crate::osrm::Coordinate;
use crate::osrm::{DistTime, OSRM};

use crate::{error, info};
use crate::{AppState, State};
use axum::Json;
use itertools::Itertools;
use chrono::{DateTime, Datelike, Duration, NaiveTime, Utc};
use chrono::{NaiveDate, NaiveDateTime};
use geo::prelude::*;
use geo::Coord;
use geo::Point;
use geojson::{GeoJson, Geometry};
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
    pub id: i32,
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

impl GetById{
    fn contained_in_time_frame(&self, start: NaiveDateTime, end: NaiveDateTime)->bool{
        (match self.time_frame_start{None=>true,Some(t)=>start >= t} &&
         match self.time_frame_end  {None=>true,Some(t)=>end <= t})
    }
}

#[derive(Deserialize)]
pub struct GetByVehicleAndChain {
    pub vehicle_id: i32,
    pub chain_id: i32,
    //pub time_frame_start: Option<NaiveDateTime>,
    //pub time_frame_end: Option<NaiveDateTime>,
}

#[derive(Deserialize)]
pub struct GetVehicleById {
    pub id: i32,
    pub active: Option<bool>,
    pub time_frame_start: Option<NaiveDateTime>,
    pub time_frame_end: Option<NaiveDateTime>,
}

#[derive(Deserialize)]
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

//_______________________________________________________________________________________________________________________

struct BestCombination {
    best_start_time_pos: usize,
    best_target_time_pos: usize,
}

#[derive(Clone)]
struct Assign {
    pub id: i32,
    departure: NaiveDateTime,
    arrival: NaiveDateTime,
    company: i32,
    vehicle: Option<i32>,
    events: Vec<Eve>,
}
impl Assign{
    fn new()->Self{
        Self{
            id:0, departure:NaiveDateTime::MIN, arrival: NaiveDateTime::MAX,company:0,vehicle:None,events:Vec::new()
        }
    }
}

#[derive(Clone)]
pub struct Eve {
    coordinates: geo::Point,
    scheduled_time: NaiveDateTime,
    communicated_time: NaiveDateTime,
    customer: i32,
    assignment: i32,
    required_specs: i32,
    request_id: i32,
    pub id: i32,
    is_pickup: bool,
}
impl Eve {
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

struct Comp {
    id: i32,
    central_coordinates: geo::Point,
    zone: i32,
    name: String,
}
impl Comp {
    fn from(
        creator: CreateCompany,
        new_id: i32,
    ) -> Self {
        Self {
            id: new_id,
            zone: creator.zone,
            name: creator.name,
            central_coordinates: Point::new(creator.lat as f64, creator.lng as f64),
        }
    }
}

#[derive(Eq, PartialEq, Hash, Copy, Clone, Debug, Deserialize)]
pub struct CapacityKey {
    pub id: i32,
    pub vehicle_specs_id: i32,
    pub company: i32,
    pub interval: Interval,
}

pub struct Data {
    users: Vec<UserData>,
    zones: Vec<geo::MultiPolygon>,
    companies: Vec<Comp>,
    assignments: Vec<Assign>,
    vehicles: Vec<vehicle::Model>,
    vehicle_specifics: Vec<vehicle_specifics::Model>,
    capacities: Capacities,
}

impl Data {
    // pub fn new() -> Self {
    //     Self {
    //         zones: Vec::<geo::MultiPolygon>::new(),
    //         companies: Vec::<Comp>::new(),
    //         assignments: Vec::<Assign>::new(),
    //         vehicles: Vec::<vehicle::Model>::new(),
    //         vehicle_specifics: Vec::<vehicle_specifics::Model>::new(),
    //         capacities: Capacities {
    //             to_insert_ids: Vec::<i32>::new(),
    //             capacities: HashMap::<CapacityKey, i32>::new(),
    //             do_not_insert: false,
    //             mark_delete: Vec::<CapacityKey>::new(),
    //             to_insert_keys: Vec::<CapacityKey>::new(),
    //             to_insert_amounts: Vec::<i32>::new(),
    //         },
    //         users: Vec::<UserData>::new(),
    //     }
    // }

    async fn read_data(
        &mut self,
        State(s): State<AppState>,
    ) {
        let zone: Vec<zone::Model> = Zone::find().all(s.db()).await.unwrap();
        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> =
            Company::find().all(s.db()).await.unwrap();
        for company_model in company_models {
            self.companies.push(Comp::from(
                CreateCompany {
                    name: company_model.name,
                    zone: company_model.zone,
                    lat: company_model.latitude,
                    lng: company_model.longitude,
                },
                company_model.id,
            ));
        }
        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> =
            Event::find().all(s.db()).await.unwrap();
        let assignment_models: Vec<<assignment::Entity as sea_orm::EntityTrait>::Model> =
            Assignment::find().all(s.db()).await.unwrap();
        match assignment_models.iter().max_by_key(|a| a.id){None=>(),Some(max)=>self.assignments.resize(max.id as usize, Assign::new())}
        for a in assignment_models{
            self.assignments[(a.id-1) as usize] = Assign{arrival: a.arrival, departure: a.departure, id: a.id, company: a.company, vehicle: a.vehicle, events: Vec::new()};
        }
        for e in event_models {
            self.assignments[(e.chain_id-1) as usize].events.push(Eve::from(
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
        self.vehicles = Vehicle::find().all(s.db()).await.unwrap();
        self.vehicle_specifics = VehicleSpecifics::find().all(s.db()).await.unwrap();
        //self.capacities = Capacity::find().all(s.db()).await.unwrap();
        for z in zone.iter() {
            let geojson = z.area.parse::<GeoJson>().unwrap();
            let feature: Geometry = Geometry::try_from(geojson).unwrap();
            self.zones
                .push(geo::MultiPolygon::try_from(feature).unwrap());
        }
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
        //println!("___________________===================____________new seats: {}", seats);
        self.internal_create_vehicle_specifics(State(s), seats, wheelchairs, storage_space)
            .await
    }

    pub async fn create_user(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<UserData>,
    ) {
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
        let mut last_insert_id = 0;
        match result {
            Ok(_) => {
                last_insert_id = result.unwrap().last_insert_id;
                info!("Vehicle with id {} created", last_insert_id)
            }
            Err(e) => error!("Error creating vehicle: {e:?}"),
        }
    }

    pub async fn create_vehicle(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateVehicle>,
    ) {
        //check whether the vehicle fits one of the existing vehicle_specs, otherwise create a new one
        let specs_id = self
            .find_or_create_vehicle_specs(
                State(s.clone()),
                /*post_request.seats,
                post_request.wheelchairs,
                post_request.storage_space, */
                3,0,0
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
        let mut last_insert_id = 0;
        match result {
            Ok(_) => {
                last_insert_id = result.unwrap().last_insert_id;
                info!("Vehicle with id {} created", last_insert_id)
            }
            Err(e) => error!("Error creating vehicle: {e:?}"),
        }

        active_m.id = ActiveValue::Set(last_insert_id);
        self.vehicles.push(active_m.try_into_model().unwrap());
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

        let mut last_insert_id = -1;
        match result {
            Ok(_) => {
                last_insert_id = result.unwrap().last_insert_id;
                info!("Vehicle specifics with id {} created", last_insert_id)
            }
            Err(e) => error!("Error creating vehicle specifics: {e:?}"),
        }

        active_m.id = ActiveValue::Set(last_insert_id);
        self.vehicle_specifics.push(active_m.try_into().unwrap());
        last_insert_id
    }

    pub async fn create_zone(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateZone>,
    ) {
        let result = Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            area: ActiveValue::Set(post_request.area.to_string()),
            name: ActiveValue::Set(post_request.name.to_string()),
        })
        .exec(s.db())
        .await;
        match result {
            Ok(_) => {
                info!("Zone created")
            }
            Err(e) => error!("Error creating zone: {e:?}"),
        }
        let geojson = post_request.area.parse::<GeoJson>().unwrap();
        let feature: Geometry = Geometry::try_from(geojson).unwrap();
        self.zones
            .push(geo::MultiPolygon::try_from(feature).unwrap());
    }

    pub async fn create_company(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateCompany>,
    ) {
        let mut active_m = company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(post_request.lng),
            latitude: ActiveValue::Set(post_request.lat),
            name: ActiveValue::Set(post_request.name.to_string()),
            zone: ActiveValue::Set(post_request.zone),
        };
        let result = Company::insert(active_m.clone()).exec(s.db()).await;

        let mut last_insert_id = -1;
        match result {
            Ok(_) => {
                last_insert_id = result.unwrap().last_insert_id;
                info!("Company created")
            }
            Err(e) => error!("Error creating company: {e:?}"),
        }
        active_m.id = ActiveValue::Set(last_insert_id);
        self.companies
            .push(Comp::from(post_request, last_insert_id));
    }

    pub async fn create_capacity(
        &mut self,
        State(s): State<AppState>,
        Json(post_request): Json<CreateCapacity>,
    ) {
        let start: NaiveDateTime = post_request.interval.start_time;
        let end: NaiveDateTime = post_request.interval.end_time;
        if end <= start {
            error!("Error creating capacity, invalid interval");
        }
        let specs_id = self
            .find_or_create_vehicle_specs(
                State(s.clone()),
                /*post_request.seats,
                post_request.wheelchairs,
                post_request.storage_space,*/
                3,0,0,
            )
            .await;
        self.capacities
            .insert(
                State(s),
                specs_id,
                post_request.company,
                &mut Interval {
                    start_time: start,
                    end_time: end,
                },
                post_request.amount,
            )
            .await;
    }


    /*
            vehicle: ActiveValue::Set(None),
            customer: ActiveValue::Set(cus),
            company: ActiveValue::Set(company),
             */


    //TODO: remove pub when events can be created by handling routing requests
    pub async fn insert_event_pair_into_db(
        &mut self,
        State(s): State<AppState>,
        address: &String,
        lng_start: f32,
        lat_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
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
        /* let result1 = Event::insert(event::ActiveModel {
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
            address: ActiveValue::Set(address.to_string()),
        })
        .exec(s.db())
        .await;
        match result1 {
            Ok(_) => {
                info!("event created");
            }
            Err(e) => error!("Error creating event: {e:?}"),
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
            address: ActiveValue::Set(address.to_string()),
        })
        .exec(s.db())
        .await;
        match result2 {
            Ok(_) => {
                info!("Event created");
            }
            Err(e) => error!("Error creating event: {e:?}"),
        } */
    }

    /*
        async fn get_companies_matching_start_point(&self, start: &geo::Point)->Vec<bool>{
            let mut viable_zone_ids = Vec::<i32>::new();
            for (pos,z) in self.zones.iter().enumerate(){
                if z.contains(start){
                    viable_zone_ids.push(pos as i32+1);
                }
            }
            let mut viable_companies = Vec::<bool>::new();
            viable_companies.resize(self.companies.len(), false);
            for (pos,c) in self.companies.iter().enumerate(){
                if viable_zone_ids.contains(&c.zone){viable_companies[pos] = true;}
            }
            viable_companies
        }

        pub async fn handle_routing_request(&mut self, State(s): State<AppState>, Json(request): Json<RoutingRequest>){

        let minimum_prep_time:Duration = Duration::seconds(3600);
        let now: NaiveDateTime = Utc::now().naive_utc();

        let sc = Coord{x: request.start_lat as f64, y: request.start_lng as f64};
        let start: Point = sc.into();
        let tc = Coord{x: request.target_lat as f64, y: request.target_lng as f64};
        let target:Point = tc.into();

        let beeline_time:Duration = Duration::minutes((AIR_DIST_SPEED * start.geodesic_distance(&target)).round() as i64);

        let mut start_time:NaiveDateTime = if request.is_start_time_fixed {request.fixed_time} else {request.fixed_time-beeline_time};
        let mut target_time:NaiveDateTime = if request.is_start_time_fixed {request.fixed_time+beeline_time} else {request.fixed_time};

        if now+minimum_prep_time < start_time {
            //TODO: reject request (companies require more time to prepare..)
        }

        //find companies, that may process the request according to their zone
        let viable_companies = self.get_companies_matching_start_point(&start).await;

        let mut start_validty:Vec<bool> = Vec::new();
        let mut target_validty:Vec<bool> = Vec::new();
        start_validty.resize(self.events.len(), false);
        target_validty.resize(self.events.len(), false);

        //For the minimum viable product:
        //The new events can only be linked to the first and last events of each chain of events.
        //This will change once the restriction on creating and expanding event-chains is lifted (TODO)
        let mut group_earliest:Vec<Option<usize>> = Vec::new();
        let mut group_latest:Vec<Option<usize>> = Vec::new();
        let mut max_chain_id = 0;
        fn check_event_validity(scheduled_time:NaiveDateTime, beeline_approach_time: Duration, beeline_return_time: Duration,
            start_time: NaiveDateTime, target_time: NaiveDateTime, start_validty:&mut Vec<bool>, target_validty:&mut Vec<bool>, pos:usize, is_pickup:bool){
            //check whether an event can be connected in a chain to the new request based on the beeline_time
            if is_pickup && scheduled_time+beeline_approach_time<start_time{
                start_validty[pos] = true;
            }
            if is_pickup && scheduled_time-beeline_return_time>target_time {
                target_validty[pos] = true;
            }
        }
        //Find events valid for start and target respectively:
        for (i, eve) in self.events.iter().enumerate() {
            if !viable_companies[i]{
                continue;
            }
            if eve.chain_id.is_none(){
                let beeline_approach_time:Duration = Duration::minutes((AIR_DIST_SPEED * eve.coordinates.geodesic_distance(&start)).round() as i64);
                let beeline_return_time:Duration = Duration::minutes((AIR_DIST_SPEED * eve.coordinates.geodesic_distance(&target)).round() as i64);
                check_event_validity(eve.scheduled_time, beeline_approach_time, beeline_return_time, start_time, target_time, &mut start_validty, &mut target_validty, i, eve.is_pickup);
            }else{
                let chain_id:usize = eve.chain_id.unwrap().try_into().unwrap();
                if group_earliest[chain_id] == None || self.events[group_earliest[chain_id].unwrap()].scheduled_time>eve.scheduled_time{
                    group_earliest[chain_id]=Some(i);
                }
                if group_latest[chain_id] == None || self.events[group_latest[chain_id].unwrap()].scheduled_time<eve.scheduled_time{
                    group_latest[chain_id]=Some(i);
                }
                if chain_id>max_chain_id {max_chain_id=chain_id;}
            }
        }
        group_earliest.resize(max_chain_id, Some(0));
        group_latest.resize(max_chain_id, Some(0));
        for i in 0..max_chain_id{
            let earliest_in_chain_id = group_earliest[i].unwrap();
            let earliest_in_chain_event = &self.events[earliest_in_chain_id];
            let latest_in_chain_id = group_latest[i].unwrap();
            let latest_in_chain_event = &self.events[latest_in_chain_id];
            let beeline_approach_time:Duration = Duration::minutes((AIR_DIST_SPEED * geo::point!(x: earliest_in_chain_event.coordinates.x(), y: earliest_in_chain_event.coordinates.y())
                .geodesic_distance(&start)).round() as i64);
            let beeline_return_time:Duration = Duration::minutes((AIR_DIST_SPEED * geo::point!(x: latest_in_chain_event.coordinates.x(), y: latest_in_chain_event.coordinates.y())
                .geodesic_distance(&target)).round() as i64);
            check_event_validity(earliest_in_chain_event.scheduled_time, beeline_approach_time, beeline_return_time, start_time, target_time,
                &mut start_validty, &mut target_validty, earliest_in_chain_id, earliest_in_chain_event.is_pickup);
            check_event_validity(latest_in_chain_event.scheduled_time, beeline_approach_time, beeline_return_time, start_time, target_time,
                &mut start_validty, &mut target_validty, latest_in_chain_id, latest_in_chain_event.is_pickup);
        }
        //For the minimum viable product:
        //Since chains may only be formed by appending a new request to the very start or very beginning of any request, there can never be a situation
        //where passengers from multiple requests are in a taxi at the same time. Thus capacity checks for adding the new request to a (possibly new) event-chain
        //is trivial.
        //TODO: do a proper capacity check once this restriction on the creation of chain events is lifted.
        if request.passengers>3 {
            //TODO: reject request
        }
        //get the actual costs
        let start_c = Coordinate{lat: request.start_lat as f64, lng: request.start_lat as f64};
        let target_c = Coordinate{lat: request.target_lat as f64, lng: request.target_lng as f64};
        let mut start_many = Vec::<Coordinate>::new();
        for c in self.companies.iter() {
            start_many.push(Coordinate{lat: c.central_coordinates.x(), lng: c.central_coordinates.y()});
        }
        for (i,ev) in self.events.iter().enumerate() {
            if !start_validty[i] {continue;}
            start_many.push(Coordinate{lat: ev.coordinates.x(), lng: ev.coordinates.y()});
        }
        start_many.push(Coordinate{lat: target.x(), lng: target.y()});// add this to get distance between start and target of the new request
        let osrm = OSRM::new();
        let mut distances_to_start: Vec<DistTime> = osrm.one_to_many(start_c, start_many).await.unwrap();
        let distance = distances_to_start.last().unwrap();

        //update start/target times using actual travel time instead of beeline-time
        start_time = if request.is_start_time_fixed {request.fixed_time} else {request.fixed_time-Duration::minutes(distance.time as i64)};
        target_time = if request.is_start_time_fixed {request.fixed_time+Duration::minutes(distance.time as i64)} else {request.fixed_time};
        distances_to_start.truncate(1);//remove distance from start to target
        let mut target_many = Vec::<Coordinate>::new();
        for c in self.companies.iter() {
            target_many.push(Coordinate{lat: c.central_coordinates.x(), lng: c.central_coordinates.y()});
        }
        for (i,ev) in self.events.iter().enumerate() {
            if !target_validty[i] {continue;}
            target_many.push(Coordinate{lat: ev.coordinates.x(), lng: ev.coordinates.y()});
        }
        let distances_to_target: Vec<DistTime> = osrm.one_to_many(target_c, target_many).await.unwrap();


        fn event_cost(is_start: bool, t: NaiveDateTime, distance: &DistTime, scheduled_time: NaiveDateTime)->i64{
                (if is_start{-1}else{1}) as i64*(t - scheduled_time).num_minutes() as i64 * MINUTE_PRICE as i64 + distance.dist as i64 * KM_PRICE as i64
        }
        fn company_cost(distance: &DistTime)->i64{
            distance.dist as i64 * KM_PRICE as i64 + distance.time as i64 * MINUTE_PRICE as i64
        }


        //sort accodring to cost function ((waiting time + driving time) * time_price + driving distance * distance_price)
        let mut start_permutation:Vec<usize> = (0..distances_to_start.len()-1).collect();
        let mut target_permutation:Vec<usize> = (0..distances_to_target.len()-1).collect();
        start_permutation.sort_by_cached_key(|idx|
            if *idx<self.companies.len() {
                company_cost(&distances_to_start[*idx])
            }else{
                event_cost(true, start_time, &distances_to_start[*idx], self.events[*idx-self.companies.len()].scheduled_time)
            }
        );
        target_permutation.sort_by_cached_key(|idx|
            if *idx<self.companies.len() {
                company_cost(&distances_to_target[*idx])
            }else{
                event_cost(false, target_time, &distances_to_target[*idx], self.events[*idx-self.companies.len()].scheduled_time)
            }
        );
        }

    async fn get_chain_minimum_capacity(chain_id:i32, events:Vec<ev>)->i32{
        let mut capacity = 3;
        let mut minimum_capacity = capacity;
        for (i, eve) in events.iter().enumerate() {
            if eve.chain_id.is_none()||eve.chain_id.unwrap()!=chain_id{continue;}
            if eve.ev_type == 0 {
                capacity += eve.passengers;
            }else{
                capacity -= eve.passengers;
            }
            if capacity<minimum_capacity {minimum_capacity=capacity;}
        }
        minimum_capacity
    }
    */

    //returns a hashmap <(amount of vehicles), (vector of intervals where this amount is available)> corresponding to the company and vehicle_spec provided by GetCapacity.
    //Time_frame fields can be used to get this data only for events fulfilling the corresponding time constraints.
    pub async fn get_capacity(
        &self,
        Json(get_request): Json<GetCapacity>,
    ) -> HashMap<i32, Vec<Interval>> {
        let mut ret = HashMap::<i32, Vec<Interval>>::new();
        let mut interval = Interval{start_time: NaiveDateTime::MIN, end_time: NaiveDateTime::MAX};
        match get_request.time_frame_start{None=>(), Some(t)=>interval.start_time = t};
        match get_request.time_frame_end{None=>(), Some(t)=>interval.end_time = t}
        for (key, val) in self.capacities.capacities.iter() {
            if get_request.company != key.company
                || !interval.touches(&key.interval)
                //vehicle_specs aren't part of mvp
                //|| get_request.vehicle_specs != key.vehicle_specs_id
            {
                continue;
            }
            ret.entry(*val)
                .and_modify(|e| e.push(key.interval))
                .or_insert(vec![key.interval]);
        }
        ret
    }

    //id->vehicle_id
    pub async fn get_assignments_for_vehicle(&self, Json(get_request): Json<GetById>)->Vec<&Assign>{
            self.assignments.iter().filter(|a| match a.vehicle{Some(v)=>v==get_request.id,None=>false} && 
            get_request.contained_in_time_frame(a.departure, a.arrival)).collect()
    }

    //id->company_id
    pub async fn get_unassigned_events_for_company(&self, Json(get_request): Json<GetById>)->Vec<&Assign>{
        self.assignments.iter().filter(|a| a.company == get_request.id && match a.vehicle {Some(_v)=>false, None=>true} &&
        get_request.contained_in_time_frame(a.departure, a.arrival)).collect()
    }

    //id->company_id
    pub async fn get_vehicles(&self, Json(get_request): Json<GetVehicleById>)->HashMap<i32, Vec<&vehicle::Model>>{
        self.vehicles.iter().filter(|v| v.company == get_request.id && match get_request.active{
            Some(a)=>a==v.active,None=>true,
        }).into_group_map_by(|v| v.specifics)
    }

    //id->user_id
    pub async fn get_events_for_user(&self, Json(get_request): Json<GetById>)->Vec<Vec<Eve>>{
        let customer_id = get_request.id;
        self.assignments.iter().cloned()
        .filter(|a| a.events.iter().any(|e| e.customer == customer_id) && get_request.contained_in_time_frame(a.departure, a.arrival))
        .map(|a| a.events.iter().cloned().filter(|e| e.customer == customer_id).collect()).collect_vec()
        /*for i in 0..user_events.len(){
            user_events[i] = user_events[i].iter().cloned().filter(|e| e.customer == customer_id).collect();
        }*/
    }

    //ignores time_frame, id->company_id
    pub async fn get_company_conflicts_for_assignment(&self, Json(get_request): Json<GetById>)->HashMap<i32, Vec<&Assign>>{
        self.assignments.iter().filter(|a| a.company == self.assignments[get_request.id as usize].company &&
        match a.vehicle{None=>false, Some(_v)=>true}).into_group_map_by(|a| a.vehicle.unwrap())
    }

    pub async fn get_vehicle_conflicts_for_assignment(&self, Json(get_request): Json<GetByVehicleAndChain>)->Vec<&Assign>{
        self.assignments.iter().filter(|a| match a.vehicle{Some(v)=> v == get_request.vehicle_id, None=>false}).collect()
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