use crate::entities::{vehicle_specifics, vehicle, company, capacity, zone, event};
use crate::{AppState,State};
use crate::entities::prelude::*;

use crate::{error,info};
use geo::Point;
use geojson::{GeoJson, Geometry,};
use sea_orm::TryIntoModel;
use sea_orm::{EntityTrait, ActiveValue};
use chrono::NaiveDateTime;
use serde::de::IntoDeserializer;
use serde::Deserialize;
use axum::Json;
use std::collections::HashMap;


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
            central_coordinates: Point::new(1.234, 2.345),
        }
    }
}

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
pub struct Interval{
    pub start_time: NaiveDateTime,
    pub end_time: NaiveDateTime,
}

impl Interval{
    pub fn overlaps(self, other: Interval)->bool{
        !(self.start_time>other.end_time||self.end_time<other.start_time)
    }
    pub fn touches(self, other: Interval)->bool{
        self.start_time<=other.start_time&&self.end_time<=other.end_time||
        self.start_time>=other.start_time&&self.end_time>=other.end_time
    }
    pub fn merge(&mut self, mut other: Interval){
        self.start_time = if self.start_time<other.start_time{self.start_time}else{other.start_time};
        self.end_time = if self.end_time<other.end_time{self.end_time}else{other.end_time};
    }
    pub fn contains(self, other: Interval)->bool{
        self.start_time<=other.start_time||self.end_time>=other.end_time
    }
    pub fn splits(self, other: Interval)->bool{
        self.start_time>other.start_time||self.end_time<other.end_time
    }
    pub fn split(self, other: Interval)->(Interval,Interval){
        (Interval{start_time: other.start_time, end_time: self.start_time},
            Interval{start_time: self.end_time, end_time: other.end_time})
    }
    pub fn cut(&mut self, other: Interval){
        if self.start_time <= other.start_time {
            self.end_time = other.start_time;
        }else{
            self.start_time = other.end_time;
        }
    }
}
/*
struct CapacityTreeRoot{
    children: Vec<CompanyNode>,
}
impl CapacityTreeRoot{
    fn insert(&mut self, company: i32, vehicle_specifics: i32, interval: Interval, amount: i32){
        let a = self.get_or_create(company).get_or_create(vehicle_specifics).insert_and_handle_overlaps(interval, amount);
    }

    fn get_or_create(&mut self, company: i32)->CompanyNode{
        for c in self.children.iter(){
            if c.company == company{
                return *c
            }
        }
        let node = CompanyNode::new(company);
        self.children.push(node);
        node
    }
}
struct CompanyNode{
    company: i32,
    children: Vec<VehicleSpecificsNode>,
}
impl CompanyNode{
    fn get_or_create(&mut self, specs: i32)->VehicleSpecificsNode{
        for vs in self.children.iter(){
            if vs.vehicle_specifics == specs{
                return *vs
            }
        }
        let node = VehicleSpecificsNode::new(specs);
        self.children.push(node);
        node
    }

    fn new(c: i32) -> Self {
        Self{
            company: c,
            children: Vec::new(),
        }
    }
}
struct VehicleSpecificsNode{
    vehicle_specifics: i32,
    children: Vec<IntervalNode>,
}
impl VehicleSpecificsNode{
    fn insert_and_handle_overlaps(&mut self, mut interval: Interval, amount: i32){
        for i in self.children.iter(){
            if !i.interval.overlaps(interval){continue;}
            if i.interval.touches(interval){
                if amount == i.amount{
                    interval.merge(i.interval);
                    //delete i.interval
                    continue;
                }else{
                    i.interval.cut(interval);
                }
            }
            if interval.contains(i.interval){
                //delete i.interval
                continue;
            }
            if interval.splits(i.interval){
                if amount != i.amount{
                    let (left,right) = interval.split(i.interval);
                    //delete i, insert: left,right,interval
                }
                return
            }
        }
        self.children.push(IntervalNode::new(interval, amount));
    }

    fn new(vs: i32) -> Self {
        Self{
            vehicle_specifics: vs,
            children: Vec::new(),
        }
    }
}
struct IntervalNode{
    interval: Interval,
    amount: i32,
}
impl IntervalNode{
    fn new(interv: Interval, a: i32) -> Self {
        Self{
            interval: interv,
            amount: a,
        }
    }
}

*/

pub struct Data{
    zones: Vec<geo::MultiPolygon>,
    companies: Vec<company::Model>,
    events: Vec<event::Model>,
    vehicles: Vec<vehicle::Model>,
    vehicle_specifics: Vec<vehicle_specifics::Model>,
    capacities: Vec<capacity::Model>,
    highest_specs_id: i32,
}

impl Data{
    pub fn new() -> Self {
        Self {zones: Vec::<geo::MultiPolygon>::new(),
            companies: Vec::<company::Model>::new(),
            events: Vec::<event::Model>::new(),
            vehicles: Vec::<vehicle::Model>::new(),
            vehicle_specifics: Vec::<vehicle_specifics::Model>::new(),
            capacities: Vec::<capacity::Model>::new(),
            highest_specs_id: 0}
    }

    pub async fn read_data(&mut self, State(s): State<AppState>){
        let zone: Vec<zone::Model> = Zone::find()
            .all(s.db())
            .await.unwrap();
        self.companies = Company::find().all(s.db()).await.unwrap();
        self.events = Event::find().all(s.db()).await.unwrap();
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
        self.create_vehicle_specifics(State(s), seats, wheelchairs, storage_space).await;
        self.highest_specs_id += 1;
        self.highest_specs_id
    }

    pub async fn create_vehicle(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateVehicle>) {
        //check whether the vehicle fits one of the existing vehicle_specs, otherwise create a new one
        let mut specs_id = -1;
        for specs in self.vehicle_specifics.iter(){
            if post_request.seats==specs.seats && post_request.wheelchairs == specs.wheelchairs && post_request.storage_space == specs.storage_space{
                specs_id = specs.id;
                break;
            }
        }
        if specs_id==-1{
            specs_id = self.find_or_create_vehicle_specs(State(s.clone()), post_request.seats,post_request.wheelchairs,post_request.storage_space).await;
        }
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

    pub async fn insert_zone(&mut self, State(s): State<AppState>, Json(post_request): Json<CreateZone>) {
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
        self.companies.push(active_m.try_into().unwrap());
    }
    /*
    pub async fn create_company(&mut self, State(s): State<AppState>, lng: f32, lat: f32, name: &str, zone: i32){
        let mut active_m = company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng),
            latitude: ActiveValue::Set(lat),
            name: ActiveValue::Set(name.to_string()),
            zone: ActiveValue::Set(zone),
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
        self.companies.push(active_m.try_into().unwrap());
    }
    */
    
    pub async fn insert_capacity(&mut self, State(s): State<AppState>, company: i32, amount: i32, seats: i32, wheelchairs: i32, storage_space: i32, start: NaiveDateTime, end_time: NaiveDateTime){
        let mut specs_id = -1;
        for specs in self.vehicle_specifics.iter(){
            if seats==specs.seats && wheelchairs == specs.wheelchairs && storage_space == specs.storage_space{
                specs_id = specs.id;
                break;
            }
        }
        if specs_id==-1{
            //since the new capacity is associated with a new set of vehicle specifics, it cannot collide with any relevant interval, since intervals are grouped by company and vehicle specifics.
            specs_id = self.find_or_create_vehicle_specs(State(s.clone()), seats, wheelchairs, storage_space).await;
        }else{

        }
        let mut active_m = capacity::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(company),
            amount: ActiveValue::Set(amount),
            vehicle_specifics: ActiveValue::Set(specs_id),
            start_time: ActiveValue::Set(start),
            end_time: ActiveValue::Set(end_time),
        };
        let result = Capacity::insert(active_m)
        .exec(s.db())
        .await;
    }
    
    pub async fn insert_event_pair(&mut self, State(s): State<AppState>, lng1: f32, lat1: f32, sched_t1: NaiveDateTime, comm_t1: NaiveDateTime, cus:i32, ch_id: Option<i32>, req_id: i32, comp: i32, pass: i32, wheel: i32, lug: i32, c_p_t1: bool,
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
        })
        .exec(s.db())
        .await;
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
        })
        .exec(s.db())
        .await;
    }
}
