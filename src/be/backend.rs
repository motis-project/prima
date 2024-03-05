use crate::entities::{vehicle_specifics, vehicle, company, capacity, zone, event};

use crate::entities::prelude::*;

use geojson::{GeoJson, Geometry,};
use sea_orm::{Database, TryIntoModel};
use std::env;
use sea_orm::{EntityTrait, ActiveValue};
use chrono::NaiveDateTime;

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

    pub async fn read_data(&mut self){
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let zone: Vec<zone::Model> = Zone::find()
            .all(&conn)
            .await.unwrap();
        self.companies = Company::find().all(&conn).await.unwrap();
        self.events = Event::find().all(&conn).await.unwrap();
        self.vehicles = Vehicle::find().all(&conn).await.unwrap();
        self.vehicle_specifics = VehicleSpecifics::find().all(&conn).await.unwrap();
        self.capacities = Capacity::find().all(&conn).await.unwrap();
        for z in zone.iter(){
            let geojson = z.area.parse::<GeoJson>().unwrap();
            let feature:Geometry = Geometry::try_from(geojson).unwrap();
            self.zones.push(geo::MultiPolygon::try_from(feature).unwrap());
        }
    }

    pub async fn find_or_create_vehicle_specs(&mut self, seats:i32, wheelchairs: i32, storage_space: i32)->i32{
        self.insert_vehicle_specifics(seats, wheelchairs, storage_space).await;
        self.highest_specs_id += 1;
        self.highest_specs_id
    }

    pub async fn insert_vehicle(&mut self, company:i32, license_plate: &str, seats:i32, wheelchairs: i32, storage_space: i32){
        let mut specs_id = -1;
        for specs in self.vehicle_specifics.iter(){
            if seats==specs.seats && wheelchairs == specs.wheelchairs && storage_space == specs.storage_space{
                specs_id = specs.id;
                break;
            }
        }
        if specs_id==-1{
            specs_id = self.find_or_create_vehicle_specs(seats,wheelchairs,storage_space).await;
        }
        self.insert_vehicle_into_db(company, license_plate, specs_id).await;
    }

    pub async fn insert_zone(&mut self, multi_polygon: &str, name: &str){ 
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let result = Zone::insert(zone::ActiveModel {
            id: ActiveValue::NotSet,
            area: ActiveValue::Set(multi_polygon.to_string()),
            name: ActiveValue::Set(name.to_string())
        })
        .exec(&conn)
        .await;
    }
    
    pub async fn insert_vehicle_specifics(&mut self, seats: i32, wheelchairs: i32, storage_space: i32){ 
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let mut active_m = vehicle_specifics::ActiveModel {
            id: ActiveValue::NotSet,
            seats: ActiveValue::Set(seats),
            wheelchairs: ActiveValue::Set(wheelchairs),
            storage_space: ActiveValue::Set(storage_space),
        };
        let result = VehicleSpecifics::insert(active_m.clone())
        .exec(&conn)
        .await;
    
        active_m.id = ActiveValue::Set(result.unwrap().last_insert_id);
        self.vehicle_specifics.push(active_m.try_into().unwrap());
    }
    
    pub async fn insert_company(&mut self, lng: f32, lat: f32, n: &str, z: i32){
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let mut active_m = company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng),
            latitude: ActiveValue::Set(lat),
            name: ActiveValue::Set(n.to_string()),
            zone: ActiveValue::Set(z),
        };
        let result = Company::insert(active_m.clone())
        .exec(&conn)
        .await;

        active_m.id = ActiveValue::Set(result.unwrap().last_insert_id);
        self.companies.push(active_m.try_into().unwrap());
    }
    
    pub async fn insert_vehicle_into_db(&mut self, c: i32, l_p: &str, spec: i32){
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let mut active_m = vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(c),
            license_plate: ActiveValue::Set(l_p.to_string()),
            specifics: ActiveValue::Set(spec),
        };
        let result = Vehicle::insert(active_m.clone())
        .exec(&conn)
        .await;

        active_m.id = ActiveValue::Set(result.unwrap().last_insert_id);
        self.vehicles.push(active_m.try_into_model().unwrap());
    }
    
    pub async fn insert_capacity(&mut self, c: i32, a: i32, spec: i32, s: NaiveDateTime, f: NaiveDateTime){
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        let result = Capacity::insert(capacity::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(c),
            amount: ActiveValue::Set(a),
            vehicle_specifics: ActiveValue::Set(spec),
            start_time: ActiveValue::Set(s),
            end_time: ActiveValue::Set(f),
        })
        .exec(&conn)
        .await;
    }
    
    pub async fn insert_event_pair(&mut self, lng1: f32, lat1: f32, sched_t1: NaiveDateTime, comm_t1: NaiveDateTime, cus:i32, ch_id: Option<i32>, req_id: i32, comp: i32, pass: i32, wheel: i32, lug: i32, c_p_t1: bool,
        lng2: f32, lat2: f32, sched_t2: NaiveDateTime, comm_t2: NaiveDateTime, c_p_t2: bool){
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
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
        .exec(&conn)
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
        .exec(&conn)
        .await;
    }

    pub async fn receive_capacity_post_request(){
        let params = [("foo", "bar"), ("baz", "quux")];
        let client = reqwest::Client::new();
        let _res = client.post("http://httpbin.org/post")
        .form(&params);
    }
}
