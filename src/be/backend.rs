use crate::entities::{vehicle_specifics, vehicle, company, capacity, zone, event, user};
use crate::entities;
use crate::{AppState,State};
use crate::entities::prelude::*;
use crate::be::interval::Interval;
use crate::constants::constants::*;
use crate::{error,info};
use crate::osrm::Coordinate;
use crate::osrm::{OSRM,DistTime};

use chrono::DateTime;
use chrono::Utc;
use geo::Coord;
use geo::Point;
use geo::prelude::*;
use geojson::{GeoJson, Geometry,};
use sea_orm::TryIntoModel;
use sea_orm::{DeleteResult, EntityTrait, ActiveValue};
use chrono::{NaiveDate, NaiveDateTime};
use serde::Deserialize;
use axum::Json;
use std::collections::HashMap;
use chrono::Duration;



#[derive(Deserialize)]
pub struct CreateCompany {
    pub lat: f32,
    pub lng: f32,
    pub zone: i32,
    pub name: String,
}


#[derive(Deserialize)]
pub struct GetCapacity{
    pub company:i32,
    pub vehicle_specs:i32,
    pub day: NaiveDate,
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

    //there are default values for the rest of the fields
    pub seats: i32,
    pub wheelchairs: i32,
    pub storage_space: i32,
}

//default for simplification in the minimum viable product
impl Default for CreateVehicle {
    fn default() -> CreateVehicle {
        CreateVehicle {
            license_plate: "".to_string(),
            company: -1,
            seats: 3,
            wheelchairs: 0,
            storage_space: 0,
        }
    }
}

#[derive(Deserialize)]
pub struct CreateCapacity{
    pub seats: i32,
    pub wheelchairs: i32,
    pub storage_space: i32,
    pub company: i32,
    pub interval: Interval,
    pub amount: i32,
}

#[derive(Deserialize)]
pub struct  RoutingRequest{
    fixed_time: NaiveDateTime,
    is_start_time_fixed: bool,
    start_lat: f32,
    start_lng: f32,
    target_lat: f32,
    target_lng: f32,
    passengers: i32,
    wheelchairs: i32,
    luggage: i32,
    customer: i32,
}


#[derive(Deserialize)]
pub struct User{
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


struct BestCombination{
    best_start_time_pos: usize,
    best_target_time_pos: usize,
}

struct Eve{
    coordinates: geo::Point,
    customer_id: i32,
    passengers: i32,
    wheelchairs: i32,
    luggage: i32,
    scheduled_time: NaiveDateTime,
    communicated_time: NaiveDateTime,
    chain_id: Option<i32>,
    request_id: i32,
    id: i32,
    company: i32,
    vehicle: Option<i32>,
    is_pickup: bool,
}
impl Eve{
    fn from(lat: f32, lng: f32, customer_id: i32, passengers: i32, wheelchairs: i32, luggage: i32, scheduled_time: NaiveDateTime,
        communicated_time: NaiveDateTime, chain_id: Option<i32>, request_id: i32, id: i32, company: i32, vehicle: Option<i32>, is_pickup: bool,)->Self{
        Self{
            coordinates: Point::new(lat as f64, lng as f64), id, customer_id, passengers,wheelchairs, luggage, scheduled_time, communicated_time, chain_id, request_id, company, vehicle, is_pickup
        }
    }
}

struct Comp{
    id: i32,
    central_coordinates: geo::Point,
    zone: i32,
    name: String,
}
impl Comp{
    fn from(creator: CreateCompany, new_id: i32)->Self{
        Self{
            id: new_id,
            zone: creator.zone,
            name: creator.name,
            central_coordinates: Point::new(creator.lat as f64, creator.lng as f64),
        }
    }
}

#[derive(Eq, PartialEq, Hash, Copy, Clone,Debug,Deserialize)]
pub struct CapacityKey{
    id: i32,
    vehicle_specs_id: i32,
    company: i32,
    pub interval: Interval,
}

pub struct Capacities{
    capacities: HashMap<CapacityKey, i32>,
    do_not_insert: bool,
    mark_delete: Vec<CapacityKey>,
    to_insert_keys: Vec<CapacityKey>,
    to_insert_amounts: Vec<i32>,
    to_insert_ids: Vec<i32>,
}
impl Capacities{
    async fn insert_into_db(&self, State(s): State<AppState>, key: &CapacityKey, new_amount: i32)->i32{
        let active_m = capacity::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(key.company),
            amount: ActiveValue::Set(new_amount),
            vehicle_specifics: ActiveValue::Set(key.vehicle_specs_id),
            start_time: ActiveValue::Set(key.interval.start_time),
            end_time: ActiveValue::Set(key.interval.end_time),
        };
        let result = Capacity::insert(active_m.clone())
        .exec(s.clone().db())
        .await;
        
        match result {
            Ok(_) => {info!("Capacity created");return result.unwrap().last_insert_id},
            Err(e) => error!("Error creating capacity: {e:?}"),
        }
        -1
    }

    async fn insert_new_capacity(&mut self, State(s): State<AppState>, vehicle_specs: i32, new_company: i32, new_interval: &mut Interval, new_amount: i32){
        let mut overlap_found = false;
        for (key, old_amount) in self.capacities.iter(){
            let old_interval = key.interval;
            if key.company != new_company || key.vehicle_specs_id != vehicle_specs || !old_interval.touches(new_interval) {continue;}
            if new_interval.contains(&old_interval){
                println!("delete==============================================={} contains {}",new_interval, old_interval);
                self.mark_delete.push(*key);
                continue;
            }
            if *old_amount == new_amount{
                if old_interval.contains(&new_interval){
                    println!("do nothing==============================================={}",new_interval);
                    self.do_not_insert = true;
                    break;
                }
                if new_interval.overlaps(&old_interval) {
                    println!("merge==============================================={} and {}",old_interval, new_interval);
                    new_interval.merge(&old_interval);
                    self.mark_delete.push(*key);
                    if overlap_found {break;}
                    overlap_found = true;
                    continue;
                }
            }else{
                if old_interval.contains(new_interval){
                    let (left,right) = old_interval.split(&new_interval);
                    println!("split==============================================={} split by{} => {}, {}",old_interval,new_interval, left, right);
                    self.to_insert_keys.push(CapacityKey{interval: left, vehicle_specs_id: key.vehicle_specs_id, company: key.company, id: -1});
                    self.to_insert_keys.push(CapacityKey{interval: right, vehicle_specs_id: key.vehicle_specs_id, company: key.company, id: -1});
                    self.to_insert_amounts.push(*old_amount);
                    self.to_insert_amounts.push(*old_amount);
                    self.mark_delete.push(*key);
                    break;
                }
                if new_interval.overlaps(&old_interval){
                    println!("cut==============================================={} by {} => {}",old_interval, new_interval, new_interval.cut(&old_interval));
                    self.to_insert_keys.push(CapacityKey{interval: new_interval.cut(&old_interval), vehicle_specs_id: key.vehicle_specs_id, company: key.company, id: -1});
                    self.to_insert_amounts.push(*old_amount);
                    println!("__________________________ keys to insert#: {} amounts to insert#:{}", self.to_insert_keys.len(), self.to_insert_amounts.len());
                    self.mark_delete.push(*key);
                    println!("__________________________ keys to delete#: {}", self.mark_delete.len());
                    if overlap_found {break;}
                    overlap_found = true;
                    continue;
                }
            }
        }
        if !self.do_not_insert {
            let new_id:i32 = self.insert_into_db(State(s), &CapacityKey{vehicle_specs_id: vehicle_specs, company: new_company, interval: *new_interval, id: -1}, new_amount).await;
            self.capacities.insert(CapacityKey{vehicle_specs_id: vehicle_specs, company: new_company, interval: *new_interval, id: new_id}, new_amount);
            println!("__________________inserted interval: {}", new_interval);
        }
        self.do_not_insert = false;
        
    }
    async fn delete_marked(&mut self, State(s): State<AppState>){
        println!("___________________delete_marked___________");
        for key in self.mark_delete.clone(){
            println!("__________________start deleting interval: {}", key.interval);
            let res: Result<DeleteResult,migration::DbErr> = Capacity::delete_by_id(key.id).exec(s.clone().db()).await;

            match res {
                Ok(_) => {info!("Interval {} deleted from db", key.interval)},
                Err(e) => error!("Error deleting interval: {e:?}"),
            }

            self.capacities.remove(&key);
            println!("__________________deleted interval: {}", key.interval);
        }
        self.mark_delete.clear();
    }
    async fn insert_collected_into_db(&mut self, State(s): State<AppState>){
        println!("______insert collected into db________ keys to insert#: {} amounts to insert#:{}", self.to_insert_keys.len(), self.to_insert_amounts.len());
        for (pos,key) in self.to_insert_keys.iter().enumerate(){
            println!("__________________start inserting interval into db: {}", key.interval);
            let new_id:i32 = self.insert_into_db(State(s.clone()), key, self.to_insert_amounts[pos]).await;
            self.to_insert_ids.push(new_id);
            println!("__________________inserted interval into db: {}", key.interval);
        }
    }

    fn insert_collected(&mut self){
        println!("______insert collected________ keys to insert#: {} amounts to insert#:{}", self.to_insert_keys.len(), self.to_insert_amounts.len());
        for (pos,key) in self.to_insert_keys.iter_mut().enumerate(){
            key.id = self.to_insert_ids[pos];
            self.capacities.insert(*key, self.to_insert_amounts[pos]);
            println!("__________________inserted interval: {}", key.interval);
        }
        self.to_insert_amounts.clear();
        self.to_insert_keys.clear();
    }

    pub async fn insert(&mut self, State(s): State<AppState>, vehicle_specs: i32, new_company: i32, new_interval: &mut Interval, new_amount: i32){
        self.insert_new_capacity(State(s.clone()), vehicle_specs,new_company,new_interval,new_amount).await;
        println!("________________________________insert_new_capcity is done");
        self.insert_collected_into_db(State(s.clone())).await;
        self.insert_collected();
        self.delete_marked(State(s)).await;
    }
}

pub struct Data{
    users: Vec<User>,
    zones: Vec<geo::MultiPolygon>,
    companies: Vec<Comp>,
    events: Vec<Eve>,
    vehicles: Vec<vehicle::Model>,
    vehicle_specifics: Vec<vehicle_specifics::Model>,
    capacities: Capacities,
    highest_specs_id: i32,
}

impl Data{
    pub fn new() -> Self {
        Self {zones: Vec::<geo::MultiPolygon>::new(), companies: Vec::<Comp>::new(), events: Vec::<Eve>::new(), vehicles: Vec::<vehicle::Model>::new(),
            vehicle_specifics: Vec::<vehicle_specifics::Model>::new(), capacities: Capacities { to_insert_ids: Vec::<i32>::new(), 
                capacities: HashMap::<CapacityKey,i32>::new(), do_not_insert: false, mark_delete: Vec::<CapacityKey>::new(), 
                to_insert_keys: Vec::<CapacityKey>::new(), to_insert_amounts: Vec::<i32>::new() }, highest_specs_id: 0, users: Vec::<User>::new(),
        }
    }

    pub async fn read_data(&mut self, State(s): State<AppState>){
        let zone: Vec<zone::Model> = Zone::find()
            .all(s.db())
            .await.unwrap();
        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> = Company::find().all(s.db()).await.unwrap();
        for company_model in company_models{
            self.companies.push(Comp::from(CreateCompany{name: company_model.name, zone: company_model.zone, lat: company_model.latitude, lng: company_model.longitude}, company_model.id));
        }
        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> = Event::find().all(s.db()).await.unwrap();
        for e in event_models{
            self.events.push(Eve::from(e.latitude,e.longitude,e.customer,e.passengers,e.wheelchairs,e.luggage,e.scheduled_time,e.communicated_time,e.chain_id,e.request_id,e.id,e.company,e.vehicle,e.is_pickup));
        }
        let user_models = entities::prelude::User::find().all(s.db()).await.unwrap();
        for user_model in user_models{
            self.users.push(User{id: Some(user_model.id), name: user_model.name, is_driver: user_model.is_driver, is_admin: user_model.is_admin, email: user_model.email, 
                password: user_model.password, salt: user_model.salt, o_auth_id: user_model.o_auth_id, o_auth_provider: user_model.o_auth_provider});
        }
        self.vehicles = Vehicle::find().all(s.db()).await.unwrap();
        self.vehicle_specifics = VehicleSpecifics::find().all(s.db()).await.unwrap();
        //self.capacities = Capacity::find().all(s.db()).await.unwrap();
        for z in zone.iter(){
            let geojson = z.area.parse::<GeoJson>().unwrap();
            let feature:Geometry = Geometry::try_from(geojson).unwrap();
            self.zones.push(geo::MultiPolygon::try_from(feature).unwrap());
        }
    }

    pub async fn find_or_create_vehicle_specs(&mut self, State(s): State<AppState>, seats:i32, wheelchairs: i32, storage_space: i32)->i32{
        for specs in self.vehicle_specifics.iter(){
            if seats==specs.seats && wheelchairs == specs.wheelchairs && storage_space == specs.storage_space{
                return specs.id
            }
        }
        //println!("___________________===================____________new seats: {}", seats);
        self.create_vehicle_specifics(State(s), seats, wheelchairs, storage_space).await;
        self.highest_specs_id += 1;
        self.highest_specs_id
    }

    pub async fn create_user(&mut self, State(s): State<AppState>, Json(post_request): Json<User>) {
        let mut active_m = user::ActiveModel {
            id: ActiveValue::NotSet,
            name: ActiveValue::Set(post_request.name),
            is_driver: ActiveValue::Set(post_request.is_driver),
            is_admin: ActiveValue::Set(post_request.is_admin),
            email: ActiveValue::Set(post_request.email),
            password: ActiveValue::Set(post_request.password),
            salt: ActiveValue::Set(post_request.salt),
            o_auth_id: ActiveValue::Set(post_request.o_auth_id),
            o_auth_provider: ActiveValue::Set(post_request.o_auth_provider),
        };
        let result = entities::prelude::User::insert(active_m.clone())
        .exec(s.db())
        .await;
        let mut last_insert_id = 0;
        match result {
            Ok(_) => {last_insert_id = result.unwrap().last_insert_id;info!("Vehicle with id {} created",last_insert_id)},
            Err(e) => error!("Error creating vehicle: {e:?}"),
        }
    }

    pub async fn create_vehicle(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateVehicle>) {
        //check whether the vehicle fits one of the existing vehicle_specs, otherwise create a new one
        let specs_id = self.find_or_create_vehicle_specs(State(s.clone()), post_request.seats,post_request.wheelchairs,post_request.storage_space).await;
        let mut active_m = vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(post_request.company),
            license_plate: ActiveValue::Set(post_request.license_plate.to_string()),
            specifics: ActiveValue::Set(specs_id),
        };
        let result = Vehicle::insert(active_m.clone())
        .exec(s.db())
        .await;
        let mut last_insert_id = 0;
        match result {
            Ok(_) => {last_insert_id = result.unwrap().last_insert_id;info!("Vehicle with id {} created",last_insert_id)},
            Err(e) => error!("Error creating vehicle: {e:?}"),
        }

        active_m.id = ActiveValue::Set(last_insert_id);
        self.vehicles.push(active_m.try_into_model().unwrap());
    }
    
    pub async fn create_vehicle_specifics(&mut self, State(s): State<AppState>, seats: i32, wheelchairs: i32, storage_space: i32){
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
            Ok(_) => {last_insert_id = result.unwrap().last_insert_id;info!("Vehicle specifics with id {} created",last_insert_id)},
            Err(e) => error!("Error creating vehicle specifics: {e:?}"),
        }

        active_m.id = ActiveValue::Set(last_insert_id);
        self.vehicle_specifics.push(active_m.try_into().unwrap());
    }

    pub async fn create_zone(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateZone>) {
        let result = Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            area: ActiveValue::Set(post_request.area.to_string()),
            name: ActiveValue::Set(post_request.name.to_string())
        })
        .exec(s.db())
        .await;
        match result {
            Ok(_) => {info!("Zone created")},
            Err(e) => error!("Error creating zone: {e:?}"),
        }
        let geojson = post_request.area.parse::<GeoJson>().unwrap();
        let feature:Geometry = Geometry::try_from(geojson).unwrap();
        self.zones.push(geo::MultiPolygon::try_from(feature).unwrap());
    }
    
    pub async fn create_company(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateCompany>) {
        let mut active_m = company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(post_request.lng),
            latitude: ActiveValue::Set(post_request.lat),
            name: ActiveValue::Set(post_request.name.to_string()),
            zone: ActiveValue::Set(post_request.zone),
        };
        let result = Company::insert(active_m.clone())
        .exec(s.db())
        .await;

        let mut last_insert_id = -1;
        match result {
            Ok(_) => {last_insert_id = result.unwrap().last_insert_id; info!("Company created")},
            Err(e) => error!("Error creating company: {e:?}"),
        }
        active_m.id = ActiveValue::Set(last_insert_id);
        self.companies.push(Comp::from(post_request, last_insert_id));
    }
    
    pub async fn create_capacity(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateCapacity>){
        let start:NaiveDateTime = post_request.interval.start_time;
        let end:NaiveDateTime = post_request.interval.end_time;
        if end<=start{
            error!("Error creating capacity, invalid interval");
        }
        let specs_id = self.find_or_create_vehicle_specs(State(s.clone()), post_request.seats, post_request.wheelchairs, post_request.storage_space).await;
        self.capacities.insert(State(s), specs_id, post_request.company, &mut Interval{start_time: start, end_time: end}, post_request.amount).await;
    }
    
    pub async fn insert_event_pair(&mut self, State(s): State<AppState>, target_address: &String, start_address: &String, lng1: f32, lat1: f32, sched_t1: NaiveDateTime, comm_t1: NaiveDateTime, cus:i32, ch_id: Option<i32>, req_id: i32, comp: i32, pass: i32, wheel: i32, lug: i32, c_p_t1: bool,
        lng2: f32, lat2: f32, sched_t2: NaiveDateTime, comm_t2: NaiveDateTime, c_p_t2: bool){
        let result1 = Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng1),
            latitude: ActiveValue::Set(lat1),
            scheduled_time: ActiveValue::Set(sched_t1),
            communicated_time: ActiveValue::Set(comm_t1),
            vehicle: ActiveValue::Set(None),
            customer: ActiveValue::Set(cus),
            chain_id: ActiveValue::Set(ch_id),
            request_id: ActiveValue::Set(req_id),
            company: ActiveValue::Set(comp),
            passengers: ActiveValue::Set(pass),
            wheelchairs: ActiveValue::Set(wheel),
            luggage: ActiveValue::Set(lug),
            is_pickup: ActiveValue::Set(true),
            connects_public_transport: ActiveValue::Set(c_p_t1),
            target_address: ActiveValue::Set(target_address.to_string()),
            start_address: ActiveValue::Set(start_address.to_string()),
        })
        .exec(s.db())
        .await;
    match result1 {
        Ok(_) => {info!("event created");},
        Err(e) => error!("Error creating event: {e:?}"),
    }
        let result2 = Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng2),
            latitude: ActiveValue::Set(lat2),
            scheduled_time: ActiveValue::Set(sched_t2),
            communicated_time: ActiveValue::Set(comm_t2),
            vehicle: ActiveValue::Set(None),
            customer: ActiveValue::Set(cus),
            chain_id: ActiveValue::Set(ch_id),
            request_id: ActiveValue::Set(req_id),
            company: ActiveValue::Set(comp),
            passengers: ActiveValue::Set(pass),
            wheelchairs: ActiveValue::Set(wheel),
            luggage: ActiveValue::Set(lug),
            is_pickup: ActiveValue::Set(false),
            connects_public_transport: ActiveValue::Set(c_p_t2),
            target_address: ActiveValue::Set(target_address.to_string()),
            start_address: ActiveValue::Set(start_address.to_string()),
        })
        .exec(s.db())
        .await;
    match result2 {
        Ok(_) => {info!("Event created");},
        Err(e) => error!("Error creating event: {e:?}"),
    }
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

    pub async fn get_capacity(&self, Json(get_request): Json<GetCapacity>)->Vec<CapacityKey>{
        let mut ret:Vec<CapacityKey> = Vec::<CapacityKey>::new();
        for (key,val) in self.capacities.capacities.iter(){
            if get_request.company!=key.company||get_request.vehicle_specs!=key.vehicle_specs_id||!key.interval.touches_day(get_request.day){continue;}
            ret.push(key.clone());
        }
        ret
    }
}


 #[cfg(test)]
 mod test {
    use crate::{Tera,Database,env,Arc,Mutex,AppState,Data};
    use chrono::NaiveDate;
    use axum::extract::State;
 
     #[tokio::test]
    async fn test() {

        let tera = match Tera::new("html/*.html") {
            Ok(t) => Arc::new(Mutex::new(t)),
            Err(e) => {
                println!("Parsing error(s): {}", e);
                ::std::process::exit(1);
            }
        };
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let s = AppState {
            tera: tera,
            db: Arc::new(conn),
        };
        let mut data = Data::new();
        //data.insert_capacity(State(s.clone()), 1, 4, 3, 0, 0,  NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 10, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(14, 30, 0).unwrap()).await;
        //data.insert_capacity(State(s.clone()), 1, 4, 3, 0, 0,  NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(11, 0, 0).unwrap(), NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(18, 00, 0).unwrap()).await;
        
    }
}