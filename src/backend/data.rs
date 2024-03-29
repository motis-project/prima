use crate::{
    backend::interval::Interval,
    constants::constants::{BEELINE_KMH, KM_PRICE, MINUTE_PRICE},
    entities::{
        assignment, availability, company, event,
        prelude::{
            Assignment, Availability, Company, Event, User, Vehicle, VehicleSpecifics, Zone,
        },
        user, vehicle, vehicle_specifics, zone,
    },
    error,
    osrm::{
        Coordinate,
        Dir::{Backward, Forward},
        DistTime, OSRM,
    },
    AppState, State, StatusCode,
};

use super::geo_from_str::multi_polygon_from_str;
use ::anyhow::Result;
use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use geo::{prelude::*, MultiPolygon, Point};
use itertools::Itertools;
use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait};
use std::collections::HashMap;

/*
StatusCode and associated errors/results:
INTERNAL_SERVER_ERROR           something bad happened
BAD_REQUEST                     invalid geojson for multipolygon (area of zone), provided ids do not match
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
#[derive(Debug, Clone, PartialEq)]
#[readonly::make]
pub struct TourData {
    pub id: i32,
    pub departure: NaiveDateTime,
    pub arrival: NaiveDateTime,
    pub vehicle: i32,
}

impl TourData {
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, departure: {}, arrival: {}\n",
            indent, self.id, self.departure, self.arrival
        );
    }

    fn touches(
        &self,
        interval: &Interval,
    ) -> bool {
        interval.touches(&Interval::new(self.departure, self.arrival))
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
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

#[derive(Debug, Clone, PartialEq)]
#[readonly::make]
pub struct VehicleData {
    pub id: i32,
    pub license_plate: String,
    pub company: i32,
    pub specifics: i32,
    pub active: bool,
    pub availability: HashMap<i32, AvailabilityData>,
    pub tours: HashMap<i32, TourData>,
}

impl VehicleData {
    fn print(&self) {
        println!(
            "id: {}, license: {}, company: {}, specs: {}",
            self.id, self.license_plate, self.company, self.specifics
        );
    }
    fn new() -> Self {
        Self {
            id: -1,
            license_plate: "".to_string(),
            company: -1,
            specifics: -1,
            active: true,
            availability: HashMap::new(),
            tours: HashMap::new(),
        }
    }
    async fn add_availability(
        &mut self,
        State(s): State<&AppState>,
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
                .exec(s.clone().db())
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
            .exec(s.db())
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

#[derive(Debug, Clone, PartialEq)]
#[readonly::make]
pub struct EventData {
    pub coordinates: Point,
    pub scheduled_time: NaiveDateTime,
    pub communicated_time: NaiveDateTime,
    pub customer: i32,
    pub tour: i32,
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
        tour: i32,
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
            tour,
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
            "{}id: {}, scheduled_time: {}, communicated_time: {}, customer: {}, tour: {}, request_id: {}, required_specs: {}, is_pickup: {}\n",
            indent, self.id, self.scheduled_time, self.communicated_time, self.customer, self.tour, self.request_id, self.required_specs, self.is_pickup
        );
    }

    fn touches(&self, interval: &Interval)->bool{
        let mut event_interval = Interval::new(self.scheduled_time, self.communicated_time,);
        event_interval.flip_if_necessary();
        event_interval.touches(interval)
    }
}

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct CompanyData {
    pub id: i32,
    pub central_coordinates: Point,
    pub zone: i32,
    pub name: String,
}

impl CompanyData {
    fn new() -> Self {
        Self {
            id: -1,
            central_coordinates: Point::new(0.0, 0.0),
            zone: -1,
            name: "".to_string(),
        }
    }
}

#[derive(PartialEq, Clone)]
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

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct ZoneData {
    pub area: MultiPolygon,
    pub name: String,
    pub id: i32,
}

#[derive(PartialEq, Clone)]
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
    fn print_tours(
        &self,
        print_events: bool,
    ) {
        for (t_id, tour) in self.vehicles.iter().flat_map(|vehicle| &vehicle.tours) {
            tour.print("");
            if print_events {
                for (_, event) in self.events.iter() {
                    if *t_id != event.tour {
                        continue;
                    }
                    event.print("   ");
                }
            }
        }
    }

    #[allow(dead_code)] //test/output function
    pub fn print_vehicles(&self) {
        for v in &self.vehicles {
            v.print();
        }
    }

    fn max_event_id(&self)->i32{
        match self.events.iter().map(|(id,_)|id).max(){
            Some(id)=>*id,
            None=>0,
        }
    }

    fn max_company_id(&self)->i32{
        match self.companies.iter().map(|company|company.id).max(){
            Some(id)=>id,
            None=>0,
        }
    }

    fn max_tour_id(&self)->i32{
        match self.vehicles.iter().flat_map(|vehicle|&vehicle.tours).map(|(id,_)|id).max(){
            Some(id)=>*id,
            None=>0,
        }
    }

    fn max_user_id(&self)->i32{
        match self.users.iter().map(|(id,_)|id).max(){
            Some(id)=>*id,
            None=>0,
        }
    }

    fn max_vehicle_id(&self)->i32{
        match self.vehicles.iter().map(|vehicle|vehicle.id).max(){
            Some(id)=>id,
            None=>0,
        }
    }
    
    pub async fn read_data_from_db(
        &mut self,
        State(s): State<&AppState>,
    ) {
        let mut zones: Vec<zone::Model> = Zone::find()
            .all(s.db())
            .await
            .expect("Error while reading from Database.");
        zones.sort_by_key(|z| z.id);
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
            .all(s.db())
            .await
            .expect("Error while reading from Database.");
        self.companies
            .resize(company_models.len(), CompanyData::new());
        for company_model in company_models {
            self.companies[id_to_vec_pos(company_model.id)] = CompanyData {
                name: company_model.name,
                zone: company_model.zone,
                central_coordinates: Point::new(
                    company_model.latitude as f64,
                    company_model.longitude as f64,
                ),
                id: company_model.id,
            };
        }

        let mut vehicle_models: Vec<<vehicle::Entity as sea_orm::EntityTrait>::Model> =
            Vehicle::find()
                .all(s.db())
                .await
                .expect("Error while reading from Database.");
        self.vehicles
            .resize(vehicle_models.len(), VehicleData::new());
        vehicle_models.sort_by_key(|v| v.id);
        for vehicle in vehicle_models.iter() {
            self.vehicles[id_to_vec_pos(vehicle.id)] = VehicleData {
                id: vehicle.id,
                license_plate: vehicle.license_plate.to_string(),
                company: vehicle.company,
                specifics: vehicle.specifics,
                active: vehicle.active,
                availability: HashMap::new(),
                tours: HashMap::new(),
            };
        }

        let availability_models: Vec<<availability::Entity as sea_orm::EntityTrait>::Model> =
            Availability::find()
                .all(s.db())
                .await
                .expect("Error while reading from Database.");
        for availability in availability_models.iter() {
            self.vehicles[id_to_vec_pos(availability.vehicle)]
                .add_availability(
                    State(&s),
                    &mut Interval {
                        start_time: availability.start_time,
                        end_time: availability.end_time,
                    },
                    Some(availability.id),
                )
                .await;
        }

        let tour_models: Vec<<assignment::Entity as sea_orm::EntityTrait>::Model> =
            Assignment::find()
                .all(s.db())
                .await
                .expect("Error while reading from Database.");
        for tour in tour_models {
            self.vehicles[id_to_vec_pos(tour.vehicle)].tours.insert(
                tour.id,
                TourData {
                    arrival: tour.arrival,
                    departure: tour.departure,
                    id: tour.id,
                    vehicle: tour.vehicle,
                },
            );
        }

        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> = Event::find()
            .all(s.db())
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
            .all(s.db())
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
            .all(s.db())
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
        State(s): State<&AppState>,
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
        .exec(s.db())
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
        State(s): State<&AppState>,
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
                State(&s),
                /*seats,
                wheelchairs,
                storage_space, */
                3,
                0,
                0,
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
        .exec(s.db())
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
                    tours: HashMap::new(),
                });
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
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
        State(s): State<&AppState>,
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
        .exec(s.db())
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
        State(s): State<&AppState>,
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
            .add_availability(State(s), &mut interval, None)
            .await
    }

    pub async fn create_zone(
        &mut self,
        State(s): State<&AppState>,
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
        .exec(s.db())
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
        State(s): State<&AppState>,
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
        .exec(s.db())
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
        State(s): State<&AppState>,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle_id: i32,
    ) -> StatusCode {
        if self.max_vehicle_id() < vehicle_id || vehicle_id as usize <= 0{
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
                    match Availability::find_by_id(existing.id)
                        .one(s.clone().db())
                        .await
                    {
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
                match Availability::update(active_m).exec(s.clone().db()).await {
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
                .exec(s.clone().db())
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
                self.create_availability(State(&s), left.start_time, left.end_time, vehicle_id)
                    .await;
                self.create_availability(State(&s), right.start_time, right.end_time, vehicle_id)
                    .await;
            }
            None => (),
        }
        StatusCode::OK
    }

    fn get_n_availabilities(&self)->usize{
        self.vehicles.iter().flat_map(|vehicle|&vehicle.availability).count()
    }

    fn get_n_tours(&self)->usize{
        self
        .vehicles
        .iter()
        .flat_map(|vehicle| &vehicle.tours)
        .count()
    }

    //TODO: remove pub when events can be created by handling routing requests
    pub async fn insert_or_addto_tour(
        &mut self,
        tour_id: Option<i32>, // tour_id == None <=> tour already exists
        departure: NaiveDateTime,
        arrival: NaiveDateTime,
        vehicle: i32,
        State(s): State<&AppState>,
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
        if !(Interval::new(departure,arrival)).is_valid()
            || !(Interval::new(sched_t_start, sched_t_target,)).is_valid()
            || !(Interval::new(comm_t_start, comm_t_target,)).is_valid()
        {
            return StatusCode::NOT_ACCEPTABLE;
        }
        if self.users.len() < customer as usize || self.vehicles.len() < vehicle as usize {
            return StatusCode::EXPECTATION_FAILED;
        }
        let id = match tour_id {
            Some(t_id) => {
                //tour already exists
                if self.get_n_tours() < t_id as usize
                {
                    return StatusCode::EXPECTATION_FAILED;
                }
                t_id
            }
            None => {
                //tour does not exist, create it in database, which yields the id
                let t_id = match Assignment::insert(assignment::ActiveModel {
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
                        error!("Error creating tour: {e:?}");
                        return StatusCode::INTERNAL_SERVER_ERROR;
                    }
                };
                //now create tour in self(data)
                (&mut self.vehicles[id_to_vec_pos(vehicle)]).tours.insert(
                    t_id,
                    TourData {
                        id: t_id,
                        departure,
                        arrival,
                        vehicle,
                    },
                );
                t_id
            }
        };
        let result = self
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
        match result{
            Err(e)=>{
                return e;
            },
            Ok((start_event_id, target_event_id))=>{
                //pickup-event
                self.events.insert(
                    start_event_id,
                    EventData {
                        coordinates: Point::new(lat_start as f64, lng_start as f64),
                        scheduled_time: sched_t_start,
                        communicated_time: comm_t_start,
                        customer,
                        tour: id,
                        required_specs: required_vehicle_specs,
                        request_id,
                        id: start_event_id,
                        is_pickup: true,
                    },
                );
                //dropoff-event
                self.events.insert(
                    target_event_id, EventData {
                        coordinates: Point::new(lat_target as f64, lng_target as f64),
                        scheduled_time: sched_t_target,
                        communicated_time: comm_t_target,
                        customer,
                        tour: id,
                        required_specs: required_vehicle_specs,
                        request_id,
                        id: target_event_id,
                        is_pickup: false,
                    },
                );
                return StatusCode::CREATED;
            }
        }
    }

    async fn insert_event_pair_into_db(
        &mut self,
        State(s): State<&AppState>,
        start_address: &String,
        target_address: &String,
        lat_start: f32,
        lng_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
        customer: i32,
        tour: i32,
        required_vehicle_specs: i32,
        request_id: i32,
        connects_public_transport1: bool,
        connects_public_transport2: bool,
        lat_target: f32,
        lng_target: f32,
        sched_t_target: NaiveDateTime,
        comm_t_target: NaiveDateTime,
    ) -> Result<(i32, i32),StatusCode> {
        let start_id = match Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_start),
            latitude: ActiveValue::Set(lat_start),
            scheduled_time: ActiveValue::Set(sched_t_start),
            communicated_time: ActiveValue::Set(comm_t_start),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(tour),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(true),
            connects_public_transport: ActiveValue::Set(connects_public_transport1),
            address: ActiveValue::Set(start_address.to_string()),
        })
        .exec(s.db())
        .await
        {
            Ok(result) => result.last_insert_id,
            Err(e) => {
                error!("Error creating event: {e:?}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        };
        match Event::insert(event::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng_target),
            latitude: ActiveValue::Set(lat_target),
            scheduled_time: ActiveValue::Set(sched_t_target),
            communicated_time: ActiveValue::Set(comm_t_target),
            customer: ActiveValue::Set(customer),
            chain_id: ActiveValue::Set(tour),
            required_vehicle_specifics: ActiveValue::Set(required_vehicle_specs),
            request_id: ActiveValue::Set(request_id),
            is_pickup: ActiveValue::Set(false),
            connects_public_transport: ActiveValue::Set(connects_public_transport2),
            address: ActiveValue::Set(target_address.to_string()),
        })
        .exec(s.db())
        .await
        {
            Ok(target_result) => Ok((start_id, target_result.last_insert_id)),
            Err(e) => {
                error!("Error creating event: {e:?}");
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    }

    pub async fn handle_routing_request(
        &mut self,
        State(s): State<&AppState>,
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
            return StatusCode::NOT_ACCEPTABLE;
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
        if now + minimum_prep_time > start_time {
            return StatusCode::NO_CONTENT;
        }

        //find companies, and vehicles that may process the request according to their zone, availability, collisions with other tours and vehicle-specifics (based on beeline distance)
        let viable_vehicles = self
            .get_viable_vehicles(Interval::new(start_time,target_time),passengers,&start,).await;

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
        let start_c = Coordinate {
            lng: start_lat,
            lat: start_lng,
        };
        let target_c = Coordinate {
            lng: target_lat,
            lat: target_lng,
        };
        //get the actual costs
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
            .insert_or_addto_tour(
                None,
                start_time,
                target_time,
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

    pub async fn change_vehicle_for_tour(
        &mut self,
        State(s): State<&AppState>,
        tour_id: i32,
        new_vehicle_id: i32,
    ) -> StatusCode {
        if self.max_vehicle_id() < new_vehicle_id  || new_vehicle_id as usize <= 0{
            return StatusCode::NOT_FOUND;
        }
        let old_vehicle_id = match self.get_tour(tour_id).await{
            Ok(tour)=> tour.vehicle,
            Err(e)=>return e,
        };
        let mut moved_tour = match self.vehicles[id_to_vec_pos(old_vehicle_id)].tours.remove(&tour_id){
            None=>return StatusCode::INTERNAL_SERVER_ERROR,
            Some(t)=> t,
        };
        moved_tour.vehicle = new_vehicle_id;
        self.vehicles[id_to_vec_pos(new_vehicle_id)].tours.insert(tour_id,moved_tour);  

        let mut active_m: assignment::ActiveModel =
            match Assignment::find_by_id(tour_id).one(s.db()).await {
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
        match active_m.update(s.db()).await {
            Ok(_) => (),
            Err(e) => {
                error!("{}", e);
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
        StatusCode::ACCEPTED
    }

    async fn get_viable_vehicles(
        &self,
        interval: Interval,
        passengers: i32,
        start: &Point,
    ) -> HashMap<i32, Vec<&VehicleData>> {
        let zone_viable_companies = self
            .companies
            .iter()
            .filter(|company| self.zones[id_to_vec_pos(company.zone)].area.contains(start))
            .collect_vec();
        self.vehicles
            .iter()
            .filter(|vehicle| 
                zone_viable_companies.contains(&&self.companies[id_to_vec_pos(vehicle.company)])
                    && self.vehicle_specifics[id_to_vec_pos(vehicle.specifics)]
                        .fulfills(passengers, 0, 0)
                    && !vehicle.tours.iter().any(|(_, tour)| {
                        //this check might disallow some concatenations of jobs where time is saved by not having to return to the company central, TODO: fix when concatenations should be supported
                        tour.touches(&interval)
                    }
                    && vehicle.availability.iter().any(|(_,availability)|availability.interval.contains(&interval)))
            )
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

    pub async fn get_tours_for_vehicle(
        &self,
        vehicle_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<&TourData>, StatusCode> {
        let time_frame = Interval::new(time_frame_start,time_frame_end);
        if time_frame.is_flipped() {
            return Err(StatusCode::NOT_ACCEPTABLE);
        }
        if self.max_vehicle_id() < vehicle_id  || vehicle_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self.vehicles[id_to_vec_pos(vehicle_id)]
            .tours
            .iter()
            .map(|(_, tour)| tour)
            .filter(|tour|tour.touches(&time_frame))
            .collect_vec())
    }

    pub async fn get_events_for_vehicle(
        &self,
        vehicle_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<&EventData>, StatusCode> {
        let time_frame = Interval {
            start_time: time_frame_start,
            end_time: time_frame_end,
        };
        if time_frame.is_flipped() {
            return Err(StatusCode::NOT_ACCEPTABLE);
        }
        if self.max_vehicle_id() < vehicle_id || vehicle_id as usize <= 0 {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self
            .events
            .iter()
            .filter(|(_, event)| {
                event.touches(&time_frame)
                    && self.vehicles[id_to_vec_pos(vehicle_id)]
                        .tours
                        .iter()
                        .any(|(t_id, _)| event.tour == *t_id)
            })
            .map(|(_, e)| e)
            .collect_vec())
    }

    pub async fn get_vehicles(
        &self,
        company_id: i32,
        active: Option<bool>,
    ) -> Result<HashMap<i32, Vec<&VehicleData>>, StatusCode> {
        if self.max_company_id() < company_id  || company_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self
            .vehicles
            .iter()
            .filter(|vehicle| {
                vehicle.company == company_id
                    && match active {
                        Some(a) => a == vehicle.active,
                        None => true,
                    }
            })
            .into_group_map_by(|v| v.specifics))
    }

    pub async fn get_events_for_user(
        &self,
        user_id: i32,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<&EventData>, StatusCode> {
        if self.max_user_id() < user_id  || user_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let time_frame = Interval {
            start_time: time_frame_start,
            end_time: time_frame_end,
        };
        if time_frame.is_flipped() {
            return Err(StatusCode::NOT_ACCEPTABLE);
        }
        Ok(self
            .events
            .iter()
            .filter(|(_, event)| {
                event.touches(&time_frame) && event.customer == user_id
            })
            .map(|(_, event)| event)
            .collect_vec())
    }

    pub async fn get_tour(
        &self,
        tour_id: i32,
    ) -> Result<&TourData, StatusCode> {
        match self
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.tours)
            .find(|(t_id, _)| **t_id == tour_id)
            .map(|(_, t)| t)
        {
            Some(t) => return Ok(t),
            None => return Err(StatusCode::NOT_FOUND),
        }
    }

    //does consider the provdided tour_id a conflict
    pub async fn get_idle_vehicles_for_company(
        &self,
        company_id: i32,
        tour_id: i32,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<&VehicleData>, StatusCode> {
        if self.max_company_id() < company_id  || company_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };
        Ok(self
            .vehicles
            .iter()
            .filter(|vehicle| {
                vehicle.company == company_id
                    && !vehicle.tours
                    .iter()
                    .filter(|(_,tour)|!(!consider_provided_tour_conflict && tour_id==tour.id))
                    .any(|(_, tour)| tour.touches(&tour_interval)
                    )
            })
            .collect_vec())
    }

    //does consider the provdided tour_id a conflict
    pub async fn is_vehicle_idle(
        &self,
        vehicle_id: i32,
        tour_id: i32,
        consider_provided_tour_conflict: bool,
    ) -> Result<bool, StatusCode> {
        if self.max_vehicle_id() < vehicle_id  || vehicle_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };
        Ok(!self.vehicles[id_to_vec_pos(vehicle_id)]
            .tours
            .iter()
            .filter(|(_,tour)|!(!consider_provided_tour_conflict && tour_id==tour.id))
            .any(|(_, tour)| tour.touches(&tour_interval)
            ))
    }

    //return vectors of conflicting tours by vehicle ids as keys
    //does not consider the provided tour_id as a conflict
    pub async fn get_company_conflicts_for_tour(
        &self,
        company_id: i32,
        tour_id: i32,
        consider_provided_tour_conflict: bool,
    ) -> Result<HashMap<i32, Vec<&TourData>>, StatusCode> {
        if self.max_company_id() < company_id  || company_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let provided_tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };

        let mut ret = HashMap::<i32, Vec<&TourData>>::new();
        self.vehicles
            .iter()
            .filter(|vehicle| vehicle.company == company_id)
            .for_each(|vehicle| {
                let conflicts = vehicle
                    .tours
                    .iter()
                    .map(|(_, tour)| tour)
                    .filter(|tour| {     
                        !(!consider_provided_tour_conflict && tour_id == tour.id)
                        && tour.touches(&provided_tour_interval)
                    })
                    .collect_vec();
                if !conflicts.is_empty() {
                    ret.insert(vehicle.id, conflicts);
                }
            });
        Ok(ret)
    }

    //does not consider the provided tour_id as a conflict
    pub async fn get_vehicle_conflicts_for_tour(
        &self,
        vehicle_id: i32,
        tour_id: i32,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<&TourData>, StatusCode> {
        if self.max_vehicle_id() < vehicle_id  || vehicle_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };
        Ok(self.vehicles[id_to_vec_pos(vehicle_id)]
            .tours
            .iter()
            .map(|(_, t)| t)
            .filter(|tour| 
                !(!consider_provided_tour_conflict && tour_id == tour.id)
                && tour.touches(&tour_interval)
            )
            .collect_vec())
    }

    pub async fn get_assignment_conflicts_for_event(
        &self,
        event_id: i32,
        company_id: Option<i32>
        )->Result<Vec<&TourData>,StatusCode>{
            if self.max_event_id() < event_id || event_id as usize <= 0{
                return Err(StatusCode::NOT_FOUND);
            }
            match company_id{
                None=>(),
                Some(id)=>if self.max_company_id()<id || id as usize <= 0{
                    return Err(StatusCode::NOT_FOUND);
                }
            }
            let event = &self.events[&event_id];
            let mut event_interval = Interval::new(event.communicated_time,event.scheduled_time);
            event_interval.flip_if_necessary();
            Ok(self.vehicles
                .iter()
                .filter(|vehicle|match company_id{
                    None=>true,
                    Some(id)=>vehicle.company==id
                })
                .flat_map(|vehicle|&vehicle.tours)
                .map(|(_,tour)|tour)
                .filter(|tour|tour.touches(&event_interval))
                .collect_vec())
    }

    pub async fn is_vehicle_available(
        &self,
        vehicle_id: i32,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> Result<bool, StatusCode> {
        if self.max_vehicle_id() < vehicle_id  || vehicle_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let interval = Interval {
            start_time,
            end_time,
        };
        if !interval.is_valid() {
            return Err(StatusCode::NOT_ACCEPTABLE);
        }
        Ok(self.vehicles[id_to_vec_pos(vehicle_id)]
            .availability
            .iter()
            .any(|(_, availability)| availability.interval.contains(&interval)))
    }

    pub async fn get_events_for_tour(
        &self,
        tour_id: i32,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
    ) -> Result<Vec<&EventData>, StatusCode> {
        if self.max_tour_id() < tour_id  || tour_id as usize <= 0{
            return Err(StatusCode::NOT_FOUND);
        }
        let interval = Interval {
            start_time,
            end_time,
        };
        if interval.is_flipped() {
            return Err(StatusCode::NOT_ACCEPTABLE);
        }
        Ok(self
            .events
            .iter()
            .map(|(_, e)| e)
            .filter(|e| e.tour == tour_id)
            .collect_vec())
    }
}

#[cfg(test)]
mod test {
    use super::ZoneData;
    use crate::{
        backend::data::Data,
        constants::{geo_points::TestPoints, gorlitz::GORLITZ},
        dotenv, env,
        init::{self, StopFor::TEST1},
        AppState, Arc, Database, Migrator, Mutex, Tera,
    };
    use axum::extract::State;
    use chrono::{Duration, NaiveDate, NaiveDateTime};
    use geo::{Contains, Point};
    use hyper::StatusCode;
    use migration::MigratorTrait;
    use serial_test::serial;
    use std::collections::HashMap;
    
    async fn insert_or_addto_test_tour(
        data: &mut Data,
        tour_id: Option<i32>,
        departure: NaiveDateTime,
        arrival: NaiveDateTime,
        vehicle: i32,
        State(s): State<&AppState>,
    ) -> StatusCode {
        data.insert_or_addto_tour(
            tour_id,
            departure,
            arrival,
            vehicle,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await
    }

    async fn check_zones_contain_correct_points(
        d: &Data,
        points: &Vec<Point>,
        expected_zones: i32,
    ) {
        for point in points.iter() {
            let companies_containing_point = d.get_companies_containing_point(point).await;
            for company in &d.companies {
                if companies_containing_point.contains(&company){
                    assert_eq!(company.zone == expected_zones, true);
                }else{
                    assert_eq!(company.zone == expected_zones, false);
                }
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
    ) {
        let mut read_data = Data::new();
        read_data.read_data_from_db(State(&s)).await;
        assert_eq!(read_data == *data, true);
    }

    async fn insert_or_add_test_tour(
        data: &mut Data,
        vehicle_id: i32,
        State(s): State<&AppState>,
    ) -> StatusCode {
        data.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            vehicle_id,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await
    }

    async fn test_main() -> AppState {
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
        AppState {
            tera,
            db: Arc::new(conn),
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_zones() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;
        let test_points = TestPoints::new();
        //Validate invalid multipolygon handling when creating zone (expect StatusCode::BAD_REQUEST)
        assert_eq!(
            d.create_zone(
                State(&s),
                "some new zone name".to_string(),
                "invalid multipolygon".to_string()
            )
            .await,
            StatusCode::BAD_REQUEST
        );
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

        check_data_db_synchronized(State(&s), &d).await;
    }
    #[tokio::test]
    #[serial]
    async fn test_key_violations() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;
        //validate UniqueKeyViolation handling when creating data (expect StatusCode::CONFLICT)
        //unique keys:  table               keys
        //              user                name, email
        //              zone                name
        //              company             name
        //              vehicle             license-plate
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
        assert_eq!(d.users.len(), n_users);
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

        //Validate ForeignKeyViolation handling when creating data (expect StatusCode::EXPECTATION_FAILED)
        //foreign keys: table               keys
        //              company             zone
        //              vehicle             company specifics           TODO: test specifics when mvp restriction on specifics is lifted
        //              availability        vehicle
        //              tour                vehicle
        //              event               user tour specifics         TODO: test specifics when mvp restriction on specifics is lifted
        let base_time = NaiveDate::from_ymd_opt(5000, 1, 1)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();
        let in_2_hours = base_time + Duration::hours(2);
        let in_3_hours = base_time + Duration::hours(3);
        let n_tours = d.get_n_tours();
        let n_events = d.events.len();
        assert_eq!(
            insert_or_add_test_tour(&mut d, 100, State(&s)).await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(
            insert_or_add_test_tour(&mut d, 100, State(&s)).await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(
            d.insert_event_pair_into_db(
                State(&s),
                &"".to_string(),
                &"".to_string(),
                0.0,
                0.0,
                in_2_hours,
                in_2_hours,
                100, //customer
                1,
                1,
                1,
                false,
                false,
                0.0,
                0.0,
                in_3_hours,
                in_3_hours
            )
            .await,
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        );
        assert_eq!(
            d.insert_event_pair_into_db(
                State(&s),
                &"".to_string(),
                &"".to_string(),
                0.0,
                0.0,
                in_2_hours,
                in_2_hours,
                1,
                100, //tour
                1,
                1,
                false,
                false,
                0.0,
                0.0,
                in_3_hours,
                in_3_hours
            )
            .await,
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        );
        assert_eq!(n_events, d.events.len());
        assert_eq!(n_tours, d.get_n_tours());
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

        check_data_db_synchronized(State(&s), &d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_invalid_id_parameter_handling() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;

        let base_time = NaiveDate::from_ymd_opt(5000, 1, 1)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();
        let in_2_hours = base_time + Duration::hours(2);
        let in_3_hours = base_time + Duration::hours(3);
        let d_copy = d.clone();

        let max_event_id = d.max_event_id();
        let max_company_id = d.max_company_id();
        let max_tour_id = d.max_tour_id();
        let max_user_id = d.max_user_id();
        //get_assignment_conflicts_for_event
        assert_eq!(
            d.get_assignment_conflicts_for_event(0, None).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_assignment_conflicts_for_event(1, None).await.is_ok(),true);
        assert_eq!(
            d.get_assignment_conflicts_for_event(max_event_id+1, None).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_assignment_conflicts_for_event(max_event_id, None).await.is_ok(),true);

        assert_eq!(
            d.get_assignment_conflicts_for_event(1, Some(0)).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_assignment_conflicts_for_event(1, Some(1)).await.is_ok(),true);
        assert_eq!(
            d.get_assignment_conflicts_for_event(1, Some(1+max_company_id)).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_assignment_conflicts_for_event(1, Some(max_company_id)).await.is_ok(),true);

        //get_company_conflicts_for_tour
        assert_eq!(
            d.get_company_conflicts_for_tour(0, 1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_company_conflicts_for_tour(1, 1, true).await.is_ok(),true);
        assert_eq!(
            d.get_company_conflicts_for_tour(max_company_id+1, 1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_company_conflicts_for_tour(max_company_id, 1, true).await.is_ok(),true);

        assert_eq!(
            d.get_company_conflicts_for_tour(1, 0, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_company_conflicts_for_tour(1, 1, true).await.is_ok(),true);
        assert_eq!(
            d.get_company_conflicts_for_tour(1, max_tour_id+1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_company_conflicts_for_tour(1, max_tour_id, true).await.is_ok(),true);

        //get_events_for_user
        assert_eq!(
            d.get_events_for_user(0, in_2_hours, in_3_hours).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_events_for_user(1, in_2_hours, in_3_hours).await.is_ok(),true);
        assert_eq!(
            d.get_events_for_user(max_user_id+1, in_2_hours, in_3_hours).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_events_for_user(max_user_id, in_2_hours, in_3_hours).await.is_ok(),true);

        //get_vehicles
        assert_eq!(
            d.get_vehicles(0, None).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_vehicles(1, None).await.is_ok(),true);
        assert_eq!(
            d.get_vehicles(max_company_id+1,  None).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_vehicles(max_company_id,  None).await.is_ok(),true);


            //TODO
        assert_eq!(
            d.get_vehicle_conflicts_for_tour(50, 1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_vehicle_conflicts_for_tour(1, 50, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_events_for_tour(50, in_2_hours, in_3_hours).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.is_vehicle_available(50, in_2_hours, in_3_hours,).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.is_vehicle_idle(1, 50, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.is_vehicle_idle(50, 1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_idle_vehicles_for_company(1, 50, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_idle_vehicles_for_company(50, 1, true).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_events_for_vehicle(50, in_2_hours, in_3_hours).await,Err(StatusCode::NOT_FOUND)
        );
        assert_eq!(
            d.get_tours_for_vehicle(50, in_2_hours, in_3_hours).await,Err( StatusCode::NOT_FOUND)
        );
        assert_eq!(d.get_tour(50).await,Err( StatusCode::NOT_FOUND));
        assert_eq!(
            d.change_vehicle_for_tour(State(&s), 50, 1).await,StatusCode::NOT_FOUND
        );
        assert_eq!(
            d.change_vehicle_for_tour(State(&s), 1, 50).await,StatusCode::NOT_FOUND
        );
        assert_eq!(
            d.remove_availability(State(&s), in_2_hours, in_3_hours, 50).await,StatusCode::NOT_FOUND,
        );
        assert_eq!(d_copy == d, true);
        check_data_db_synchronized(State(&s), &d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_invalid_interval_parameter_handling() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;
        let d_copy = d.clone();

        let base_time = NaiveDate::from_ymd_opt(5000, 1, 1)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();
        let in_2_hours = base_time + Duration::hours(2);
        let in_3_hours = base_time + Duration::hours(3);
        //flipped interval
        assert_eq!(
            d.get_tours_for_vehicle(1, in_3_hours, in_2_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //interval range not limited
        assert_eq!(
            match d.get_tours_for_vehicle(1, NaiveDateTime::MIN, NaiveDateTime::MAX).await
            {
                Err(e) => {
                    println!("{e:?}");
                    false
                }
                Ok(_) => true,
            },
            true
        );
        //flipped interval
        assert_eq!(
            d.get_events_for_user(1, in_3_hours, in_2_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //interval range not limited
        assert_eq!(
            match d.get_events_for_user(1, NaiveDateTime::MIN, NaiveDateTime::MAX).await
            {
                Err(e) => {
                    println!("{e:?}");
                    false
                }
                Ok(_) => true,
            },
            true
        );
        //flipped interval
        assert_eq!(
            d.get_events_for_tour(1, in_3_hours, in_2_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //interval range not limited
        assert_eq!(
            match d.get_events_for_tour(1, NaiveDateTime::MIN, NaiveDateTime::MAX).await
            {
                Err(e) => {
                    println!("{e:?}");
                    false
                }
                Ok(_) => true,
            },
            true
        );
        //flipped interval
        assert_eq!(
            d.get_events_for_vehicle(1, in_3_hours, in_2_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //interval range not limited
        assert_eq!(
            match d.get_events_for_vehicle(1, NaiveDateTime::MIN, NaiveDateTime::MAX).await
            {
                Err(e) => {
                    println!("{e:?}");
                    false
                }
                Ok(_) => true,
            },
            true
        );
        let n_availabilities = d.get_n_availabilities();
        //flipped interval
        assert_eq!(
            d.create_availability(State(&s), base_time + Duration::hours(1), base_time, 1)
                .await,StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.get_n_availabilities(),
            n_availabilities
        );
        //starttime before year 2024
        assert_eq!(
            d.create_availability(
                State(&s),
                NaiveDateTime::MIN,
                base_time + Duration::hours(1),
                1
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.get_n_availabilities(),
            n_availabilities
        );
        //endtime after year 100000
        assert_eq!(
            d.create_availability(
                State(&s),
                base_time,
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
            d.get_n_availabilities(),
            n_availabilities
        );
        //flipped interval
        assert_eq!(
            d.remove_availability(State(&s), base_time + Duration::hours(1), base_time, 1)
                .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(
            d.get_n_availabilities(),
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
            d.get_n_availabilities(),
            n_availabilities
        );
        //flipped interval
        assert_eq!(
            d.is_vehicle_available(1, in_3_hours, in_2_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //starttime before year 2024
        assert_eq!(
            d.is_vehicle_available(1, NaiveDateTime::MIN, in_3_hours).await,Err(StatusCode::NOT_ACCEPTABLE)
        );
        //endtime after year 100000
        assert_eq!(
            d.is_vehicle_available(1, in_3_hours, NaiveDateTime::MAX).await,Err(StatusCode::NOT_ACCEPTABLE)
        );

        assert_eq!(d == d_copy, true);
        check_data_db_synchronized(State(&s), &d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_init() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;

        assert_eq!(d.vehicles.len(), 29);
        assert_eq!(d.zones.len(), 3);
        assert_eq!(d.companies.len(), 8);

        let test_points = TestPoints::new();
        d.change_vehicle_for_tour(State(&s), 1, 2).await;

        //get_company_conflicts_for_tour
        for company in d.companies.iter() {
            let conflicts = match d.get_company_conflicts_for_tour(company.id, 1, true).await {
                Ok(c) => c,
                Err(_) => HashMap::new(),
            };
            assert_eq!(conflicts.is_empty(), company.id != 1);
            for (v, tours) in conflicts.iter() {
                assert_eq!(company.id, 1);
                assert_eq!(tours.len() == 0, *v != 2);
            }
        }

        //get_events_for_user
        for (user_id, _) in d.users.iter() {
            assert_eq!(
                d.get_events_for_user(
                    *user_id,
                    NaiveDate::from_ymd_opt(2024, 1, 1)
                        .unwrap()
                        .and_hms_opt(1, 0, 0)
                        .unwrap(),
                    NaiveDate::from_ymd_opt(6000, 4, 15)
                        .unwrap()
                        .and_hms_opt(14, 0, 0)
                        .unwrap(),
                )
                .await
                .unwrap()
                .is_empty(),
                *user_id != 2 // only user 2 has events
            );
            if *user_id == 2{
                assert_eq!(d.get_events_for_user(
                    *user_id,
                    NaiveDate::from_ymd_opt(2024, 1, 1)
                        .unwrap()
                        .and_hms_opt(1, 0, 0)
                        .unwrap(),
                    NaiveDate::from_ymd_opt(6000, 4, 15)
                        .unwrap()
                        .and_hms_opt(14, 0, 0)
                        .unwrap(),
                    )
                    .await
                    .unwrap().len(),2
                );
            }
        }

        //get_vehicles
        for company in d.companies.iter() {
            let vehicles = d.get_vehicles(company.id, None).await.unwrap();
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

        //insert vehicle with non-existing vehicle-specifics test should be added if specifics are no longer restricted for mvp->TODO

        assert_eq!(d.vehicles[1].tours.len(), 1);
        assert_eq!(
            d.get_events_for_vehicle(2, NaiveDateTime::MIN, NaiveDateTime::MAX)
                .await
                .unwrap()
                .len(),
            2
        );
        insert_or_add_test_tour(&mut d, 2, State(&s)).await;
        assert_eq!(d.vehicles[1].tours.len(), 2);
        assert_eq!(
            d.get_events_for_vehicle(2, NaiveDateTime::MIN, NaiveDateTime::MAX)
                .await
                .unwrap()
                .len(),
            4
        );

        for company in d.companies.iter() {
            let conflicts = match d.get_company_conflicts_for_tour(company.id, 1, true).await {
                Ok(c) => c,
                Err(_) => HashMap::new(),
            };
            assert_eq!(conflicts.is_empty(), company.id != 1);
            for (v, tours) in conflicts.iter() {
                assert_eq!(company.id, 1);
                assert_eq!(tours.len() == 0, *v != 2);
                assert_eq!(tours.len() == 2, *v == 2);
            }
        }

        insert_or_add_test_tour(&mut d, 7, State(&s)).await;
        assert_eq!(d.vehicles[1].tours.len(), 2);
        assert_eq!(
            d.get_events_for_vehicle(2, NaiveDateTime::MIN, NaiveDateTime::MAX)
                .await
                .unwrap()
                .len(),
            4
        );
        assert_eq!(d.vehicles[6].tours.len(), 1);
        assert_eq!(
            d.get_events_for_vehicle(7, NaiveDateTime::MIN, NaiveDateTime::MAX)
                .await
                .unwrap()
                .len(),
            2
        );
        for tour_id in 1..4 {
            //vehicle 2 has tours with ids 1 and 2, vehicle 7 has tour with id 3, no other vehicles have tours
            if tour_id == 3 {
                //consider_provided_tour_conflict parameter only affects vehicle 7, since it is assigned tour_id  (3)
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(2, tour_id, true)
                        .await
                        .unwrap()
                        .len(),
                    2
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(2, tour_id, false)
                        .await
                        .unwrap()
                        .len(),
                    2
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(7, tour_id, true)
                        .await
                        .unwrap()
                        .len(),
                    1
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(7, tour_id, false) 
                        .await
                        .unwrap()
                        .len(),
                    0
                );
            } else if tour_id == 1 || tour_id == 2 {
                //consider_provided_tour_conflict parameter only affects vehicle 2, since it is assigned tour_id  (1 or 2)
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(2, tour_id, true)
                        .await
                        .unwrap()
                        .len(),
                    2
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(2, tour_id, false)
                        .await
                        .unwrap()
                        .len(),
                    1
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(7, tour_id, true)
                        .await
                        .unwrap()
                        .len(),
                    1
                );
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(7, tour_id, false)
                        .await
                        .unwrap()
                        .len(),
                    1
                );
            } 
            for v_id in 1..d.vehicles.len() + 1 {
                if v_id == 7 || v_id == 2 {
                    continue;
                }
                assert_eq!(
                    d.get_vehicle_conflicts_for_tour(v_id as i32, tour_id, true)
                        .await
                        .unwrap()
                        .len(),
                    0
                );
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

        check_data_db_synchronized(State(&s), &d).await;
    }

    #[tokio::test]
    #[serial]
    async fn availability_test() {
        let s = test_main().await;
        let mut d = init::init(State(&s), true, TEST1).await;
        let n_vehicles = d.vehicles.len();

        let base_time = NaiveDate::from_ymd_opt(5000, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap();
        let in_2_hours = base_time + Duration::hours(2);
        let in_3_hours = base_time + Duration::hours(3);

        //remove_availability and create_availability
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //remove availabilies created in init
        d.remove_availability(
            State(&s),
            NaiveDate::from_ymd_opt(2024, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2026, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap(),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 0);
        //add non-touching
        d.create_availability(State(&s), in_2_hours, in_3_hours, 1)
            .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //add touching
        d.create_availability(
            State(&s),
            in_2_hours + Duration::hours(1),
            in_3_hours + Duration::hours(1),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //add containing/contained (equal)
        d.create_availability(State(&s), in_2_hours, in_3_hours, 1)
            .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);

        //remove non-touching
        d.remove_availability(
            State(&s),
            base_time + Duration::weeks(1),
            base_time + Duration::weeks(2),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //remove split
        d.remove_availability(
            State(&s),
            in_2_hours + Duration::minutes(5),
            in_3_hours - Duration::minutes(5),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 2);
        //remove overlapping
        d.remove_availability(
            State(&s),
            in_2_hours - Duration::minutes(90),
            in_3_hours - Duration::minutes(100),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 2);
        //remove containing
        d.remove_availability(
            State(&s),
            in_2_hours - Duration::minutes(1),
            in_3_hours + Duration::hours(3),
            1,
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 0);

        //Validate StatusCode cases
        //insert availability with non-existing vehicle
        let n_availabilities = d.get_n_availabilities();
        assert_eq!(
            d.create_availability(
                State(&s),
                base_time,
                base_time + Duration::hours(1),
                1 + n_vehicles as i32
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(
            d.get_n_availabilities(),
            n_availabilities
        );
        //insert availability with existing vehicle
        let n_availabilities = d.get_n_availabilities();
        assert_eq!(
            d.create_availability(
                State(&s),
                base_time,
                base_time + Duration::hours(1),
                n_vehicles as i32
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(
            d.get_n_availabilities(),
            n_availabilities + 1
        );
        let n_availabilities = d.get_n_availabilities();

        assert_eq!(
            d.get_n_availabilities(),
            n_availabilities
        );

        //Validate nothing happened case handling when removing availabilies (expect StatusCode::NO_CONTENT)
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
            d.get_n_availabilities(),
            n_availabilities
        );

        d.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            1,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await;

        d.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            1,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await;

        d.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            1,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await;

        d.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            1,
            State(&s),
            &"karolinenplatz 5".to_string(),
            &"Lichtwiesenweg 3".to_string(),
            13.867512445295205,
            51.22069201951501,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            1,
            1,
            false,
            false,
            14.025081097762154,
            51.195075641827316,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await;

        check_data_db_synchronized(State(&s), &d).await;
    }
}
