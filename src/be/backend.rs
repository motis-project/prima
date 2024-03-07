use crate::entities::{vehicle_specifics, vehicle, company, capacity, zone, event};
use crate::{AppState,State};
use crate::entities::prelude::*;
use crate::be::interval::Interval;

use crate::{error,info};
use geo::Point;
use geojson::{GeoJson, Geometry,};
use sea_orm::TryIntoModel;
use sea_orm::{EntityTrait, ActiveValue};
use chrono::NaiveDateTime;
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


#[derive(Eq, PartialEq, Hash, Copy, Clone,Debug)]
pub struct CapacityKey{
    vehicle_specs_id: i32,
    company: i32,
    interval: Interval,
}


pub struct Capacities{
    capacities: HashMap<CapacityKey, i32>,
    do_not_insert: bool,
    mark_delete: Vec<CapacityKey>,
    to_insert_keys: Vec<CapacityKey>,
    to_insert_amounts: Vec<i32>,
}
impl Capacities{

    async fn insert_into_db(&self, State(s): State<AppState>, key: &CapacityKey, new_amount: i32){
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
            Ok(_) => {info!("Capacity created")},
            Err(e) => error!("Error creating capacity: {e:?}"),
        }
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
                    self.to_insert_keys.push(CapacityKey{interval: left, vehicle_specs_id: key.vehicle_specs_id, company: key.company});
                    self.to_insert_keys.push(CapacityKey{interval: right, vehicle_specs_id: key.vehicle_specs_id, company: key.company});
                    self.to_insert_amounts.push(*old_amount);
                    self.to_insert_amounts.push(*old_amount);
                    self.mark_delete.push(*key);
                    break;
                }
                if new_interval.overlaps(&old_interval){
                    println!("cut==============================================={} by {} => {}",old_interval, new_interval, new_interval.cut(&old_interval));
                    self.to_insert_keys.push(CapacityKey{interval: new_interval.cut(&old_interval), vehicle_specs_id: key.vehicle_specs_id, company: key.company});
                    self.to_insert_amounts.push(*old_amount);
                    self.mark_delete.push(*key);
                    if overlap_found {break;}
                    overlap_found = true;
                    continue;
                }
            }
        }
        if !self.do_not_insert {
            self.insert_into_db(State(s), &CapacityKey{vehicle_specs_id: vehicle_specs, company: new_company, interval: *new_interval}, new_amount).await;
            self.capacities.insert(CapacityKey{vehicle_specs_id: vehicle_specs, company: new_company, interval: *new_interval}, new_amount);
            println!("inserted interval: {}", new_interval);
        }
        self.do_not_insert = false;
        
    }
    async fn delete_marked(&mut self, State(s): State<AppState>){
        for key in self.mark_delete.clone(){
            self.capacities.remove(&key);
            println!("deleted interval: {}", key.interval);
        }
        self.mark_delete.clear();
    }
    async fn insert_collected(&mut self, State(s): State<AppState>){
        for (pos,key) in self.to_insert_keys.iter().enumerate(){
            self.insert_into_db(State(s.clone()), key, self.to_insert_amounts[pos]).await;
            self.capacities.insert(*key, self.to_insert_amounts[pos]);
            println!("inserted interval: {}", key.interval);
        }
        self.to_insert_amounts.clear();
        self.to_insert_keys.clear();
    }

    pub async fn insert(&mut self, State(s): State<AppState>, vehicle_specs: i32, new_company: i32, new_interval: &mut Interval, new_amount: i32){
        self.insert_new_capacity(State(s.clone()), vehicle_specs,new_company,new_interval,new_amount).await;
        self.insert_collected(State(s.clone())).await;
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
            capacities: Capacities { capacities: HashMap::<CapacityKey,i32>::new(), do_not_insert: false, mark_delete: Vec::<CapacityKey>::new(), to_insert_keys: Vec::<CapacityKey>::new(), to_insert_amounts: Vec::<i32>::new() },
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
    
    pub async fn insert_capacity(&mut self, State(s): State<AppState>, company: i32, amount: i32, seats: i32, wheelchairs: i32, storage_space: i32, start: NaiveDateTime, end: NaiveDateTime){
        if end<=start{
            error!("Error creating capacity");
        }
        let mut specs_id = -1;
        for specs in self.vehicle_specifics.iter(){
            if seats==specs.seats && wheelchairs == specs.wheelchairs && storage_space == specs.storage_space{
                specs_id = specs.id;
                break;
            }
        }
        if specs_id==-1{
            //The new capacity is associated with a new set of vehicle specifics, it cannot collide with any relevant interval, since intervals are grouped by company and vehicle specifics.
            specs_id = self.find_or_create_vehicle_specs(State(s.clone()), seats, wheelchairs, storage_space).await;
            
            let active_m = capacity::ActiveModel {
                id: ActiveValue::NotSet,
                company: ActiveValue::Set(company),
                amount: ActiveValue::Set(amount),
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
        self.capacities.insert_new_capacity(State(s), specs_id, company, &mut Interval{start_time: start, end_time: end}, amount);
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

/*
#[cfg(test)]
mod test {
    use crate::be::backend::HashMap;
    use crate::be::backend::CapacityKey;
    use chrono::NaiveDate;
    use crate::be::interval::Interval;
    use super::Capacities;
    use chrono::Timelike;

    #[test]
    fn test() {
        let interval: Interval =  Interval{start_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 0, 0).unwrap(), end_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(10, 0, 0).unwrap()};
        let interval1: Interval =  Interval{start_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(12, 0, 0).unwrap(), end_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(13, 0, 0).unwrap()};
        let interval2: Interval =  Interval{start_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 30, 0).unwrap(), end_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(10, 30, 0).unwrap()};
        let interval3: Interval =  Interval{start_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(8, 30, 0).unwrap(), end_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 30, 0).unwrap()};
        let interval5: Interval =  Interval{start_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 15, 0).unwrap(), end_time: NaiveDate::from_ymd_opt(2024, 4, 15).unwrap().and_hms_opt(9, 45, 0).unwrap()};
        let mut interval_merge1_2: Interval = interval.clone();
        interval_merge1_2.merge(&interval2);
        assert_eq!(interval_merge1_2.start_time.hour(), 9);
        assert_eq!(interval_merge1_2.start_time.minute(), 0);
        assert_eq!(interval_merge1_2.end_time.hour(), 10);
        assert_eq!(interval_merge1_2.end_time.minute(), 30);
        let (left,right) = interval.split(&interval5);
        let mut interval_merge_3_5 = interval3.clone();
        interval_merge_3_5.merge(&interval5);
        
        let mut cap = Capacities{capacities: HashMap::<CapacityKey, i32>::new(),
            do_not_insert: false,
            mark_delete: Vec::<CapacityKey>::new(),
            to_insert_keys: Vec::<CapacityKey>::new(),
            to_insert_amounts: Vec::<i32>::new(),};

            println!("_____________________{}",interval);
        cap.insert(&1, &1, &mut interval.clone(), 5);//9:00 - 10:00
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 1);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);

        println!("_____________________{}",interval1);
        cap.insert(&1, &1, &mut interval1.clone(), 5);//12:00 - 13:00
        //interval and interval1 do not touch an should both appear in capacities
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 2);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);
        
        println!("_____________________{}",interval2);
        cap.insert(&1, &1, &mut interval2.clone(), 5);//9:00 - 10:30
        //interval_merge1_2: 9:00 - 10:30
        //interval1 and 2 are overlapping, since they were introduced with the same amount, the merged interval is expected to be in capacities
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval_merge1_2},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 2);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);
        
        println!("_____________________{}",interval3);
        assert_eq!(interval3.cut(&interval_merge1_2).start_time.hour(), 9);
        assert_eq!(interval3.cut(&interval_merge1_2).start_time.minute(), 30);
        assert_eq!(interval3.cut(&interval_merge1_2).end_time.hour(), 10);
        assert_eq!(interval3.cut(&interval_merge1_2).end_time.minute(), 30);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);


        cap.insert(&1, &1, &mut interval3.clone(), 4);//8:30 - 9:30
        //interval3.cut(&interval_merge1_2): 9:30 - 10:30
        //reintroducing interval should leave (interval_merge_1_2 cut by interval and interval) in capacities (since they were introduced with different amounts)
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval3},).unwrap(),4 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval3.cut(&interval_merge1_2)},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 3);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);


        println!("_____________________{}",interval5);
        cap.insert(&1, &1, &mut interval5.clone(), 4);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval_merge_3_5},).unwrap(),4 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval_merge_3_5.cut(&interval_merge1_2)},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 3);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);


        println!("_____________________{}",interval);
        cap.insert(&1, &1, &mut interval.clone(), 3);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval},).unwrap(),3 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval.cut(&interval_merge_3_5)},).unwrap(),4 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval.cut(&interval2)},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 4);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);
        

        println!("__________________left___{}",left);//split
        println!("_________________right____{}",right);//split
        println!("_____________________{}",interval5);//split
        cap.insert(&1, &1, &mut interval5.clone(), 1);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: left},).unwrap(),3 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: right},).unwrap(),3 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval5},).unwrap(),1 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval.cut(&interval_merge_3_5)},).unwrap(),4 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval.cut(&interval2)},).unwrap(),5 as i32);
        assert_eq!(*cap.capacities.get(&CapacityKey{vehicle_specs_id: 1, company: 1, interval: interval1},).unwrap(),5 as i32);
        assert_eq!(cap.capacities.keys().len(), 6);
        assert_eq!(cap.do_not_insert, false);
        assert_eq!(cap.mark_delete.is_empty(), true);
        assert_eq!(cap.to_insert_amounts.is_empty(), true);
        assert_eq!(cap.to_insert_keys.is_empty(), true);

    }
}
 */