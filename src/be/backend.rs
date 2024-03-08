use crate::entities::{vehicle_specifics, vehicle, company, capacity, zone, event};
use crate::{AppState,State};
use crate::entities::prelude::*;
use crate::be::interval::Interval;

use crate::{error,info};
use geo::Point;
use geojson::{GeoJson, Geometry,};
use sea_orm::TryIntoModel;
use sea_orm::{DeleteResult, EntityTrait, ActiveValue};
use chrono::{NaiveDate, NaiveDateTime};
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
pub struct CapacityInsert{
    pub seats: i32,
    pub wheelchairs: i32,
    pub storage_space: i32,
    pub company: i32,
    pub interval: Interval,
    pub amount: i32,
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
    zones: Vec<geo::MultiPolygon>,
    companies: Vec<company::Model>,
    events: Vec<event::Model>,
    vehicles: Vec<vehicle::Model>,
    vehicle_specifics: Vec<vehicle_specifics::Model>,
    capacities: Capacities,
    highest_specs_id: i32,
}

impl Data{
    pub fn new() -> Self {
        Self {zones: Vec::<geo::MultiPolygon>::new(),
            companies: Vec::<company::Model>::new(),
            events: Vec::<event::Model>::new(),
            vehicles: Vec::<vehicle::Model>::new(),
            vehicle_specifics: Vec::<vehicle_specifics::Model>::new(),
            capacities: Capacities { to_insert_ids: Vec::<i32>::new(), capacities: HashMap::<CapacityKey,i32>::new(), do_not_insert: false, mark_delete: Vec::<CapacityKey>::new(), to_insert_keys: Vec::<CapacityKey>::new(), to_insert_amounts: Vec::<i32>::new() },
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
    
    pub async fn create_capacity(&mut self, State(s): State<AppState>, Json(post_request): Json<CapacityInsert>){
        let start:NaiveDateTime = post_request.interval.start_time;
        let end:NaiveDateTime = post_request.interval.end_time;
        if end<=start{
            error!("Error creating capacity, invalid interval");
        }
        let mut specs_id = -1;
        for specs in self.vehicle_specifics.iter(){
            if post_request.seats==specs.seats && post_request.wheelchairs == specs.wheelchairs && post_request.storage_space == specs.storage_space{
                specs_id = specs.id;
                break;
            }
        }
        if specs_id==-1{
            //The new capacity is associated with a new set of vehicle specifics, it cannot collide with any relevant interval, since intervals are grouped by company and vehicle specifics.
            specs_id = self.find_or_create_vehicle_specs(State(s.clone()), post_request.seats, post_request.wheelchairs, post_request.storage_space).await;
            
            let active_m = capacity::ActiveModel {
                id: ActiveValue::NotSet,
                company: ActiveValue::Set(post_request.company),
                amount: ActiveValue::Set(post_request.amount),
                vehicle_specifics: ActiveValue::Set(specs_id),
                start_time: ActiveValue::Set(start),
                end_time: ActiveValue::Set(end),
            };
            let result = Capacity::insert(active_m)
            .exec(s.db())
            .await;

            match result {
                Ok(_) => {info!("Capacity created")},
                Err(e) => error!("Error creating capacity: {e:?}"),
            }
        }
        self.capacities.insert(State(s), specs_id, post_request.company, &mut Interval{start_time: start, end_time: end}, post_request.amount).await;
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