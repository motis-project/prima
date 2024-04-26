use super::geo_from_str::multi_polygon_from_str;
use crate::{
    backend::{
        id_types::{
            AddressIdT, CompanyIdT, EventIdT, IdT, IndexIdT, TourIdT, UserIdT, VehicleIdT, ZoneIdT,
        },
        interval::Interval,
        lib::{PrimaCompany, PrimaData, PrimaEvent, PrimaTour, PrimaUser, PrimaVehicle},
    },
    constants::primitives::{
        BEELINE_KMH, MINUTE_PRICE, MINUTE_WAITING_PRICE, MIN_PREP_MINUTES, PASSENGER_CHANGE_MINUTES,
    },
    entities::{
        address, availability, company, event,
        prelude::{Address, Availability, Company, Event, Request, Tour, User, Vehicle, Zone},
        request, tour, user, vehicle, zone,
    },
    error,
    osrm::{
        Dir::{Backward, Forward},
        DistTime, OSRM,
    },
};
use ::anyhow::Result;
use async_trait::async_trait;
use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use geo::{prelude::*, Coord, MultiPolygon, Point};
use hyper::StatusCode;
use itertools::Itertools;
use sea_orm::DbConn;
use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait};
use std::collections::HashMap;
use tracing::info;

#[derive(PartialEq, Eq, Hash)]
enum TourConcatCase {
    NewTour {
        company_id: CompanyIdT,
    },
    Prepend {
        vehicle_id: VehicleIdT,
        next_event_time: NaiveDateTime,
    },
    Append {
        vehicle_id: VehicleIdT,
        previous_event_time: NaiveDateTime,
    },
}

struct PossibleAssignment {
    case: TourConcatCase,
    cost: i32,
}

impl PossibleAssignment {
    fn new(case: TourConcatCase) -> Self {
        Self {
            case,
            cost: std::i32::MIN,
        }
    }

    fn compute_cost(
        &mut self,
        approach_duration: i32,
        return_duration: i32,
        start_time: &NaiveDateTime,
        target_time: &NaiveDateTime,
    ) {
        let driving_minutes = approach_duration + return_duration;
        let waiting_minutes = match self.case {
            TourConcatCase::NewTour { company_id: _ } => 0,
            TourConcatCase::Append {
                vehicle_id: _,
                previous_event_time,
            } => (previous_event_time - *target_time).num_minutes() as i32 - return_duration,
            TourConcatCase::Prepend {
                vehicle_id: _,
                next_event_time,
            } => (next_event_time - *start_time).num_minutes() as i32 - approach_duration,
        };
        self.cost = MINUTE_PRICE * driving_minutes + MINUTE_WAITING_PRICE * waiting_minutes;
    }
}

fn is_user_role_valid(
    is_driver: bool,
    is_disponent: bool,
    is_admin: bool,
    company_id: Option<CompanyIdT>,
) -> bool {
    match company_id {
        None => {
            if is_driver || is_disponent {
                return false;
            }
        }
        Some(_) => {
            if !is_driver && !is_disponent {
                return false;
            }
        }
    }
    if is_admin && (is_driver || is_disponent) {
        return false;
    }
    true
}

fn seconds_to_minutes(seconds: i32) -> i32 {
    assert!(seconds >= 0);
    seconds / 60
}

fn seconds_to_minutes_duration(seconds: f64) -> Duration {
    assert!(seconds >= 0.0);
    Duration::minutes(seconds_to_minutes(seconds as i32) as i64)
}

fn beeline_duration(
    p1: &Point,
    p2: &Point,
) -> Duration {
    // x is longitude and y is latitude!
    Duration::minutes(hrs_to_minutes(
        meter_to_km_f(p1.geodesic_distance(p2)) / BEELINE_KMH,
    ))
}

fn meter_to_km_f(m: f64) -> f64 {
    assert!(m >= 0.0); // TODO make sure this check can't produce errors because of rounding
    m / 1000.0
}

fn hrs_to_minutes(h: f64) -> i64 {
    assert!(h >= 0.0);
    (h * 60.0) as i64
}

fn is_valid(interval: &Interval) -> bool {
    interval.start_time >= Utc::now().naive_utc()
        && interval.end_time
            <= NaiveDate::from_ymd_opt(10000, 1, 1)
                .unwrap()
                .and_hms_opt(0, 0, 0)
                .unwrap()
}

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct TourData {
    id: TourIdT,
    departure: NaiveDateTime, //departure from taxi central
    arrival: NaiveDateTime,   //arrival at taxi central
    vehicle: VehicleIdT,
    events: Vec<EventData>,
}

#[async_trait]
impl PrimaTour for TourData {
    async fn get_events(&self) -> Vec<Box<&dyn PrimaEvent>> {
        self.events
            .iter()
            .map(|event| Box::new(event as &dyn PrimaEvent))
            .collect_vec()
    }

    async fn get_arrival(&self) -> NaiveDateTime {
        self.arrival
    }

    async fn get_departure(&self) -> NaiveDateTime {
        self.departure
    }

    async fn get_id(&self) -> TourIdT {
        self.id
    }
}

impl TourData {
    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, departure: {}, arrival: {}, vehicle: {}",
            indent,
            self.id.id(),
            self.departure,
            self.arrival,
            self.vehicle.id()
        );
    }

    fn overlaps(
        &self,
        interval: &Interval,
    ) -> bool {
        interval.overlaps(&Interval::new(self.departure, self.arrival))
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
#[readonly::make]
pub struct AvailabilityData {
    id: i32,
    interval: Interval,
}

#[cfg(test)]
impl AvailabilityData {
    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!("{}id: {}, interval: {}", indent, self.id, self.interval);
    }
}

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct UserData {
    id: UserIdT,
    name: String,
    is_driver: bool,
    is_disponent: bool,
    company_id: Option<CompanyIdT>,
    is_admin: bool,
    email: String,
    password: Option<String>,
    salt: String,
    o_auth_id: Option<String>,
    o_auth_provider: Option<String>,
}

#[async_trait]
impl PrimaUser for UserData {
    async fn get_id(&self) -> &UserIdT {
        &self.id
    }

    async fn get_name(&self) -> &str {
        &self.name
    }

    async fn is_driver(&self) -> bool {
        self.is_driver
    }

    async fn is_disponent(&self) -> bool {
        self.is_disponent
    }

    async fn is_admin(&self) -> bool {
        self.is_admin
    }

    async fn get_company_id(&self) -> &Option<CompanyIdT> {
        &self.company_id
    }
}

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct VehicleData {
    id: VehicleIdT,
    license_plate: String,
    company: CompanyIdT,
    seats: i32,
    wheelchair_capacity: i32,
    storage_space: i32,
    availability: HashMap<i32, AvailabilityData>,
    tours: Vec<TourData>,
}

impl VehicleData {
    fn fulfills_requirements(
        &self,
        passengers: i32,
    ) -> bool {
        passengers < 4 //TODO when mvp-restrictions are lifted
    }

    async fn get_tour(
        &mut self,
        tour_id: &TourIdT,
    ) -> Result<&mut TourData, StatusCode> {
        match self.tours.iter_mut().find(|tour| tour.id == *tour_id) {
            Some(t) => Ok(t),
            None => Err(StatusCode::NOT_FOUND),
        }
    }
}

#[async_trait]
impl PrimaVehicle for VehicleData {
    async fn get_id(&self) -> &VehicleIdT {
        &self.id
    }

    async fn get_license_plate(&self) -> &str {
        &self.license_plate
    }

    async fn get_company_id(&self) -> &CompanyIdT {
        &self.company
    }

    async fn get_tours(&self) -> Vec<Box<&dyn PrimaTour>> {
        self.tours
            .iter()
            .map(|tour| Box::new(tour as &dyn PrimaTour))
            .collect_vec()
    }
}

impl VehicleData {
    #[cfg(test)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, license: {}, company: {}, seats: {}, wheelchair_capacity: {}, storage_space: {}",indent,
            self.id.id(), self.license_plate, self.company.id(), self.seats, self.wheelchair_capacity, self.storage_space
        );
    }
    fn new() -> Self {
        Self {
            id: VehicleIdT::new(-1),
            license_plate: "".to_string(),
            company: CompanyIdT::new(-1),
            seats: -1,
            wheelchair_capacity: -1,
            storage_space: -1,
            availability: HashMap::new(),
            tours: Vec::new(),
        }
    }
    async fn add_availability(
        &mut self,
        db_conn: &DbConn,
        new_interval: &mut Interval,
        id_or_none: Option<i32>, //None->insert availability into db, this yields the id->create availability in data with this id.  Some->create in data with given id, nothing to do in db
    ) -> StatusCode {
        let mut mark_delete: Vec<i32> = Vec::new();
        for (id, existing) in self.availability.iter() {
            if !existing.interval.overlaps(new_interval) {
                if existing.interval.touches(new_interval) && existing.interval != *new_interval {
                    mark_delete.push(*id);
                    *new_interval = new_interval.merge(&existing.interval);
                }
                continue;
            }
            if existing.interval.contains(new_interval) {
                return StatusCode::OK;
            }
            if new_interval.contains(&existing.interval) {
                mark_delete.push(*id);
            }
            if new_interval.overlaps(&existing.interval) {
                mark_delete.push(*id);
                *new_interval = new_interval.merge(&existing.interval);
            }
        }
        for to_delete in mark_delete {
            match Availability::delete_by_id(self.availability[&to_delete].id)
                .exec(db_conn)
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
                vehicle: ActiveValue::Set(self.id.id()),
            })
            .exec(db_conn)
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
            None => StatusCode::CREATED,
            Some(_) => {
                error!("Key already existed in availability");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }
}

#[derive(Clone, PartialEq)]
#[readonly::make]
pub struct EventData {
    id: EventIdT,
    coordinates: Point,
    scheduled_time: NaiveDateTime,
    communicated_time: NaiveDateTime,
    customer: UserIdT,
    tour: TourIdT,
    passengers: i32,
    wheelchairs: i32,
    luggage: i32,
    request_id: i32,
    is_pickup: bool,
    address_id: AddressIdT,
}

#[async_trait]
impl PrimaEvent for EventData {
    async fn get_id(&self) -> &EventIdT {
        &self.id
    }

    async fn get_customer_id(&self) -> UserIdT {
        self.customer
    }

    async fn get_lat(&self) -> f32 {
        self.coordinates.0.x as f32
    }

    async fn get_lng(&self) -> f32 {
        self.coordinates.0.y as f32
    }

    async fn get_address_id(&self) -> &AddressIdT {
        &self.address_id
    }
}

impl EventData {
    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, scheduled_time: {}, communicated_time: {}, customer: {}, tour: {}, request_id: {}, passengers: {}, wheelchairs: {}, luggage: {}, is_pickup: {}, address_id: {}, lat: {}, lng: {}",
            indent, self.id.id(), self.scheduled_time, self.communicated_time, self.customer.id(), self.tour.id(), self.request_id, self.passengers, self.wheelchairs, self.luggage, self.is_pickup, self.address_id.id(), self.coordinates.y(), self.coordinates.x()
        );
    }

    fn overlaps(
        &self,
        interval: &Interval,
    ) -> bool {
        interval.overlaps(&Interval::new(self.scheduled_time, self.communicated_time))
    }
}

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct CompanyData {
    id: CompanyIdT,
    central_coordinates: Point,
    zone: ZoneIdT,
    name: String,
    email: String,
}

#[async_trait]
impl PrimaCompany for CompanyData {
    async fn get_id(&self) -> &CompanyIdT {
        &self.id
    }

    async fn get_name(&self) -> &str {
        &self.name
    }
}

impl CompanyData {
    fn new() -> Self {
        Self {
            id: CompanyIdT::new(-1),
            central_coordinates: Point::new(0.0, 0.0),
            zone: ZoneIdT::new(-1),
            name: "".to_string(),
            email: "".to_string(),
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!(
            "{}id: {}, lat: {}, lng: {}, zone_id: {}, name: {}, email: {}",
            indent,
            self.id.id(),
            self.central_coordinates.y(),
            self.central_coordinates.x(),
            self.zone.id(),
            self.name,
            self.email
        );
    }
}

#[derive(Debug, PartialEq, Clone)]
pub struct AddressData {
    id: i32,
    address: String,
}

impl AddressData {
    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!("{}id: {}, address: {}", indent, self.id, self.address);
    }
}

#[derive(PartialEq, Clone)]
#[readonly::make]
pub struct ZoneData {
    area: MultiPolygon,
    name: String,
    id: ZoneIdT,
}

impl ZoneData {
    #[cfg(test)]
    #[allow(dead_code)]
    fn print(
        &self,
        indent: &str,
    ) {
        println!("{}id: {}, name: {}", indent, self.id.id(), self.name);
    }
}

#[derive(Clone)]
#[readonly::make]
pub struct Data {
    users: HashMap<UserIdT, UserData>,
    zones: Vec<ZoneData>,        //indexed by (id-1)
    companies: Vec<CompanyData>, //indexed by (id-1)
    vehicles: Vec<VehicleData>,  //indexed by (id-1)
    addresses: Vec<AddressData>,
    db_connection: DbConn,
    osrm: OSRM,
}

impl PartialEq for Data {
    fn eq(
        &self,
        other: &Data,
    ) -> bool {
        self.users == other.users
            && self.zones == other.zones
            && self.companies == other.companies
            && self.vehicles == other.vehicles
    }
}

#[async_trait]
impl PrimaData for Data {
    async fn handle_routing_request(
        &mut self,
        fixed_time: NaiveDateTime,
        is_start_time_fixed: bool,
        start_lat: f32,
        start_lng: f32,
        target_lat: f32,
        target_lng: f32,
        customer: UserIdT,
        passengers: i32,
        start_address: &str,
        target_address: &str,
        //wheelchairs: i32, luggage: i32, TODO
    ) -> StatusCode {
        // TODOs:
        //- add buffer based on travel time or duration
        //- compute costs based on distance instead of travel time, when osm provides the distances
        //- manage communicated times and use them to allow more concatenations
        if !self.users.contains_key(&customer) {
            return StatusCode::NOT_FOUND;
        }
        if passengers < 1 {
            return StatusCode::EXPECTATION_FAILED;
        }
        if passengers > 3 {
            // TODO: change when mvp restriction is lifted
            return StatusCode::NO_CONTENT;
        }
        let now: NaiveDateTime = Utc::now().naive_utc();
        if now > fixed_time {
            return StatusCode::NOT_ACCEPTABLE;
        }
        let minimum_prep_time: Duration = Duration::minutes(MIN_PREP_MINUTES);

        let start_c = Coord {
            y: start_lat as f64,
            x: start_lng as f64,
        };
        let target_c = Coord {
            y: target_lat as f64,
            x: target_lng as f64,
        };

        let start = Point::from(start_c);
        let target = Point::from(target_c);

        let osrm_result = match self
            .osrm
            .one_to_many(start_c, vec![target_c], Forward)
            .await
        {
            Ok(r) => r,
            Err(_) => Vec::new(),
        };

        if osrm_result.is_empty() {
            return StatusCode::NOT_FOUND;
        }
        if osrm_result.len() > 1 {
            return StatusCode::INTERNAL_SERVER_ERROR;
        }

        let travel_duration = seconds_to_minutes_duration(osrm_result[0].time);
        let (start_time, target_time) = if is_start_time_fixed {
            (fixed_time, fixed_time + travel_duration)
        } else {
            (fixed_time - travel_duration, fixed_time)
        };
        if now + minimum_prep_time > start_time {
            return StatusCode::NO_CONTENT;
        }

        let passenger_change_duration = Duration::minutes(PASSENGER_CHANGE_MINUTES);
        let travel_interval = Interval::new(
            start_time - passenger_change_duration,
            target_time + passenger_change_duration,
        );

        // Find vehicles that may process the request according their vehicle-specifics and to the zone of their company.
        let candidate_vehicles = self.get_candidate_vehicles(passengers, &start).await;

        let mut candidate_assignments = Vec::<PossibleAssignment>::new();
        let mut start_many = Vec::<Coord>::new();
        let mut target_many = Vec::<Coord>::new();
        let mut case_idx_to_start_idx = Vec::<usize>::new();
        let mut case_idx_to_target_idx = Vec::<usize>::new();
        let mut start_idx = 0;
        let mut target_idx = 0;
        let mut start_company_idx = 0;
        let mut target_company_idx = 0;
        // there are 4 general cases:
        // Creating a NewTour with only the new request (general case exists per company) or
        // (Prepend, Append, Insert) - the request to/between existing tour(s) (general case exists per vehicle)
        // For each case check wether it can be ruled out based on beeline-travel-durations, otherwise create it.
        // Also collect all the necessary coordinates for the osrm-requests (in start_many and target_many)
        // and link each case to the respective coordinates (in case_idx_to_start_many_idx and case_idx_to_target_many_idx)

        //Insert case is being ignored for now.
        for (company_id, vehicles) in candidate_vehicles
            .iter()
            .into_group_map_by(|vehicle| vehicle.company)
        {
            let mut was_company_inserted_into_start_many = false;
            let mut was_company_inserted_into_target_many = false;
            let company_coordinates = &self.companies[company_id.as_idx()].central_coordinates;
            let approach_duration = beeline_duration(company_coordinates, &start);
            let return_duration = beeline_duration(company_coordinates, &target);
            if vehicles.iter().any(|vehicle| {
                self.may_vehicle_operate_during::<false, false>(
                    vehicle,
                    &travel_interval.expand(approach_duration, return_duration),
                )
            }) {
                candidate_assignments.push(PossibleAssignment::new(TourConcatCase::NewTour {
                    company_id,
                }));
                start_many.push(Coord::from(*company_coordinates));
                target_many.push(Coord::from(*company_coordinates));
                case_idx_to_start_idx.push(start_idx);
                case_idx_to_target_idx.push(target_idx);
                start_idx += 1;
                target_idx += 1;
                start_company_idx = start_idx;
                target_company_idx = target_idx;
                was_company_inserted_into_target_many = true;
                was_company_inserted_into_start_many = true;
            }
            for vehicle in vehicles.iter() {
                let predecessor_event_opt = vehicle
                    .tours
                    .iter()
                    .filter(|tour| tour.departure < travel_interval.start_time)
                    .flat_map(|tour| &tour.events)
                    .max_by_key(|event| event.scheduled_time);
                let successor_event_opt = vehicle
                    .tours
                    .iter()
                    .filter(|tour| tour.arrival > travel_interval.end_time)
                    .flat_map(|tour| &tour.events)
                    .min_by_key(|event| event.scheduled_time);
                match predecessor_event_opt {
                    None => (),
                    Some(pred_event) => {
                        if self.may_vehicle_operate_during::<true, false>(
                            vehicle,
                            &travel_interval.expand(
                                beeline_duration(&pred_event.coordinates, &start),
                                return_duration,
                            ),
                        ) {
                            candidate_assignments.push(PossibleAssignment::new(
                                TourConcatCase::Append {
                                    vehicle_id: vehicle.id,
                                    previous_event_time: pred_event.scheduled_time,
                                },
                            ));
                            case_idx_to_start_idx.push(start_idx);
                            start_many.push(Coord::from(pred_event.coordinates));
                            start_idx += 1;
                            if !was_company_inserted_into_target_many {
                                target_company_idx = target_idx;
                                target_idx += 1;
                                target_many.push(Coord::from(*company_coordinates));
                                was_company_inserted_into_target_many = true;
                            }
                            case_idx_to_target_idx.push(target_company_idx);
                        }
                    }
                }
                match successor_event_opt {
                    None => (),
                    Some(succ_event) => {
                        if self.may_vehicle_operate_during::<false, true>(
                            vehicle,
                            &travel_interval.expand(
                                approach_duration,
                                beeline_duration(&succ_event.coordinates, &target),
                            ),
                        ) {
                            candidate_assignments.push(PossibleAssignment::new(
                                TourConcatCase::Prepend {
                                    vehicle_id: vehicle.id,
                                    next_event_time: succ_event.scheduled_time,
                                },
                            ));
                            case_idx_to_target_idx.push(target_idx);
                            target_many.push(Coord::from(succ_event.coordinates));
                            target_idx += 1;
                            if !was_company_inserted_into_start_many {
                                start_company_idx = start_idx;
                                start_idx += 1;
                                start_many.push(Coord::from(*company_coordinates));
                                was_company_inserted_into_start_many = true;
                            }
                            case_idx_to_start_idx.push(start_company_idx);
                        }
                    }
                }
            }
        }

        let distances_to_start: Vec<DistTime> =
            match self.osrm.one_to_many(start_c, start_many, Backward).await {
                Ok(r) => r,
                Err(e) => {
                    error!("problem with osrm: {}", e);
                    Vec::new()
                }
            };
        let distances_to_target: Vec<DistTime> =
            match self.osrm.one_to_many(target_c, target_many, Forward).await {
                Ok(r) => r,
                Err(e) => {
                    error!("problem with osrm: {}", e);
                    Vec::new()
                }
            };

        // compute cost for each possible way of accepting the request
        for (i, candidate) in candidate_assignments.iter_mut().enumerate() {
            candidate.compute_cost(
                seconds_to_minutes(distances_to_start[case_idx_to_start_idx[i]].time as i32),
                seconds_to_minutes(distances_to_target[case_idx_to_target_idx[i]].time as i32),
                &start_time,
                &target_time,
            );
        }

        // sort all possible ways of accepting the request by their cost, then find the cheapest one which fulfills the required time constraints with actual travelling durations instead of beeline-durations
        let mut cost_permutation = (0..candidate_assignments.len()).collect_vec();
        cost_permutation.sort_by(|i, j| {
            candidate_assignments[*i]
                .cost
                .cmp(&candidate_assignments[*j].cost)
        });
        let mut chosen_tour_id: Option<TourIdT> = None;
        let mut chosen_vehicle_id: Option<VehicleIdT> = None;
        for i in cost_permutation.iter() {
            let approach_duration =
                seconds_to_minutes_duration(distances_to_start[case_idx_to_start_idx[*i]].time);
            let return_duration =
                seconds_to_minutes_duration(distances_to_target[case_idx_to_target_idx[*i]].time);
            match candidate_assignments[*i].case {
                TourConcatCase::NewTour { company_id } => {
                    for (candidate_company_id, vehicles) in candidate_vehicles
                        .iter()
                        .into_group_map_by(|vehicle| vehicle.company)
                    {
                        if company_id != candidate_company_id {
                            continue;
                        }
                        chosen_vehicle_id = vehicles
                            .iter()
                            .find(|vehicle| {
                                self.may_vehicle_operate_during::<true, true>(
                                    vehicle,
                                    &travel_interval.expand(approach_duration, return_duration),
                                )
                            })
                            .map(|vehicle| vehicle.id);
                        break;
                    }
                    if chosen_vehicle_id.is_some() {
                        info!(
                            "Request accepted! Case: NewTour for company: {}",
                            company_id.id()
                        );
                        break;
                    }
                }
                TourConcatCase::Append {
                    vehicle_id,
                    previous_event_time: _,
                } => {
                    if self.may_vehicle_operate_during::<true, false>(
                        &self.vehicles[vehicle_id.as_idx()],
                        &travel_interval.expand(approach_duration, return_duration),
                    ) {
                        chosen_tour_id = self.vehicles[vehicle_id.as_idx()]
                            .tours
                            .iter()
                            .filter(|tour| {
                                tour.events
                                    .iter()
                                    .map(|event| event.scheduled_time)
                                    .max()
                                    .unwrap()
                                    < start_time
                            })
                            .max_by_key(|tour| tour.arrival)
                            .map(|tour| tour.id);
                        chosen_vehicle_id = Some(vehicle_id);
                        info!(
                            "Request accepted! Case: Append for vehicle: {} and tour: {}",
                            vehicle_id.id(),
                            chosen_tour_id.unwrap().id()
                        );
                        break;
                    }
                }
                TourConcatCase::Prepend {
                    vehicle_id,
                    next_event_time: _,
                } => {
                    if self.may_vehicle_operate_during::<false, true>(
                        &self.vehicles[vehicle_id.as_idx()],
                        &travel_interval.expand(approach_duration, return_duration),
                    ) {
                        chosen_tour_id = self.vehicles[vehicle_id.as_idx()]
                            .tours
                            .iter()
                            .filter(|tour| tour.departure > target_time)
                            .min_by_key(|tour| tour.departure)
                            .map(|tour| tour.id);
                        chosen_vehicle_id = Some(vehicle_id);
                        info!(
                            "Request accepted! Case: Prepend for vehicle: {} and tour: {}",
                            vehicle_id.id(),
                            chosen_tour_id.unwrap().id()
                        );
                        break;
                    }
                }
            };
        }

        if chosen_vehicle_id.is_none() {
            return StatusCode::NO_CONTENT;
        }
        return self
            .insert_or_addto_tour(
                chosen_tour_id,
                start_time,
                target_time,
                chosen_vehicle_id.unwrap(),
                start_address,
                target_address,
                start_lat,
                start_lng,
                start_time,
                start_time,
                customer,
                passengers,
                0,
                0,
                target_lat,
                target_lng,
                target_time,
                target_time,
            )
            .await;
    }

    async fn get_address(
        &self,
        address_id: &AddressIdT,
    ) -> &str {
        &self.addresses[address_id.as_idx()].address
    }

    async fn read_data_from_db(&mut self) {
        let mut address_models: Vec<address::Model> = Address::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        address_models.sort_by_key(|a| a.id);
        for a in address_models.iter() {
            self.addresses.push(AddressData {
                id: a.id,
                address: a.address.to_string(),
            });
        }

        let mut zones: Vec<zone::Model> = Zone::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        zones.sort_by_key(|z| z.id);
        for zone in zones.iter() {
            match multi_polygon_from_str(&zone.area) {
                Err(e) => error!("{e:?}"),
                Ok(mp) => self.zones.push(ZoneData {
                    area: mp,
                    name: zone.name.to_string(),
                    id: ZoneIdT::new(zone.id),
                }),
            }
        }

        let company_models: Vec<<company::Entity as sea_orm::EntityTrait>::Model> = Company::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        self.companies
            .resize(company_models.len(), CompanyData::new());
        for company_model in company_models {
            let company_id = CompanyIdT::new(company_model.id);
            self.companies[company_id.as_idx()] = CompanyData {
                name: company_model.display_name,
                zone: ZoneIdT::new(company_model.zone),
                central_coordinates: Point::new(
                    company_model.longitude as f64,
                    company_model.latitude as f64,
                ),
                id: company_id,
                email: company_model.email,
            };
        }

        let mut vehicle_models: Vec<<vehicle::Entity as sea_orm::EntityTrait>::Model> =
            Vehicle::find()
                .all(&self.db_connection)
                .await
                .expect("Error while reading from Database.");
        self.vehicles
            .resize(vehicle_models.len(), VehicleData::new());
        vehicle_models.sort_by_key(|v| v.id);
        for vehicle in vehicle_models.iter() {
            let vehicle_id = VehicleIdT::new(vehicle.id);
            self.vehicles[vehicle_id.as_idx()] = VehicleData {
                id: vehicle_id,
                license_plate: vehicle.license_plate.to_string(),
                company: CompanyIdT::new(vehicle.company),
                seats: vehicle.seats,
                wheelchair_capacity: vehicle.wheelchair_capacity,
                storage_space: vehicle.storage_space,
                availability: HashMap::new(),
                tours: Vec::new(),
            };
        }

        let availability_models: Vec<<availability::Entity as sea_orm::EntityTrait>::Model> =
            Availability::find()
                .all(&self.db_connection)
                .await
                .expect("Error while reading from Database.");
        for availability in availability_models.iter() {
            self.vehicles[VehicleIdT::new(availability.vehicle).as_idx()]
                .add_availability(
                    &self.db_connection,
                    &mut Interval::new(availability.start_time, availability.end_time),
                    Some(availability.id),
                )
                .await;
        }

        let tour_models: Vec<<tour::Entity as sea_orm::EntityTrait>::Model> = Tour::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        for tour in tour_models {
            let vehicle_id = VehicleIdT::new(tour.vehicle);
            self.vehicles[vehicle_id.as_idx()].tours.push(TourData {
                arrival: tour.arrival,
                departure: tour.departure,
                id: TourIdT::new(tour.id),
                vehicle: vehicle_id,
                events: Vec::new(),
            });
        }
        let event_models: Vec<<event::Entity as sea_orm::EntityTrait>::Model> = Event::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        for event_m in event_models {
            let request_m: <request::Entity as sea_orm::EntityTrait>::Model =
                Request::find_by_id(event_m.request)
                    .one(&self.db_connection)
                    .await
                    .expect("Error while reading from Database.")
                    .unwrap();
            let tour_id = TourIdT::new(request_m.tour);
            let vehicle_id = self.get_tour(tour_id).await.unwrap().vehicle;
            self.vehicles[vehicle_id.as_idx()]
                .get_tour(&tour_id)
                .await
                .unwrap()
                .events
                .push(EventData {
                    id: EventIdT::new(event_m.id),
                    coordinates: Point::new(event_m.longitude as f64, event_m.latitude as f64),
                    scheduled_time: event_m.scheduled_time,
                    communicated_time: event_m.communicated_time,
                    customer: UserIdT::new(request_m.customer),
                    passengers: request_m.passengers,
                    wheelchairs: request_m.wheelchairs,
                    luggage: request_m.luggage,
                    tour: tour_id,
                    request_id: event_m.request,
                    is_pickup: event_m.is_pickup,
                    address_id: AddressIdT::new(event_m.address),
                });
        }

        let user_models = User::find()
            .all(&self.db_connection)
            .await
            .expect("Error while reading from Database.");
        for user_model in user_models {
            let user_id = UserIdT::new(user_model.id);
            self.users.insert(
                user_id,
                UserData {
                    id: user_id,
                    name: user_model.display_name,
                    is_driver: user_model.is_driver,
                    is_disponent: user_model.is_disponent,
                    company_id: user_model.company.map(CompanyIdT::new),
                    is_admin: user_model.is_admin,
                    email: user_model.email,
                    password: user_model.password,
                    salt: user_model.salt,
                    o_auth_id: user_model.o_auth_id,
                    o_auth_provider: user_model.o_auth_provider,
                },
            );
        }
    }

    async fn create_vehicle(
        &mut self,
        license_plate: &str,
        company: CompanyIdT,
    ) -> StatusCode {
        if self.max_company_id() < company.id() {
            return StatusCode::EXPECTATION_FAILED;
        }
        if self
            .vehicles
            .iter()
            .any(|vehicle| vehicle.license_plate == license_plate)
        {
            return StatusCode::CONFLICT;
        }
        let seats = 3;
        let wheelchair_capacity = 0;
        let storage_space = 0;

        match Vehicle::insert(vehicle::ActiveModel {
            id: ActiveValue::NotSet,
            company: ActiveValue::Set(company.id()),
            license_plate: ActiveValue::Set(license_plate.to_string()),
            seats: ActiveValue::Set(seats),
            wheelchair_capacity: ActiveValue::Set(wheelchair_capacity),
            storage_space: ActiveValue::Set(storage_space),
        })
        .exec(&self.db_connection)
        .await
        {
            Ok(result) => {
                self.vehicles.push(VehicleData {
                    id: VehicleIdT::new(result.last_insert_id),
                    license_plate: license_plate.to_string(),
                    company,
                    seats,
                    wheelchair_capacity,
                    storage_space,
                    availability: HashMap::new(),
                    tours: Vec::new(),
                });
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:?}");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    async fn create_user(
        &mut self,
        name: &str,
        is_driver: bool,
        is_disponent: bool,
        company: Option<CompanyIdT>,
        is_admin: bool,
        email: &str,
        password: Option<String>,
        salt: &str,
        o_auth_id: Option<String>,
        o_auth_provider: Option<String>,
    ) -> StatusCode {
        if self.users.values().any(|user| user.email == *email) {
            return StatusCode::CONFLICT;
        }
        if !is_user_role_valid(is_driver, is_disponent, is_admin, company) {
            return StatusCode::BAD_REQUEST;
        }
        match company {
            None => (),
            Some(c_id) => {
                if !c_id.is_in_range(1, self.max_company_id()) {
                    return StatusCode::NOT_FOUND;
                }
            }
        }
        match User::insert(user::ActiveModel {
            id: ActiveValue::NotSet,
            display_name: ActiveValue::Set(name.to_string()),
            is_driver: ActiveValue::Set(is_driver),
            is_admin: ActiveValue::Set(is_admin),
            email: ActiveValue::Set(email.to_string()),
            password: ActiveValue::Set(password.clone()),
            salt: ActiveValue::Set(salt.to_string()),
            o_auth_id: ActiveValue::Set(o_auth_id.clone()),
            o_auth_provider: ActiveValue::Set(o_auth_provider.clone()),
            company: ActiveValue::Set(company.map(|company_id| company_id.id())),
            is_active: ActiveValue::Set(true),
            is_disponent: ActiveValue::Set(is_disponent),
        })
        .exec(&self.db_connection)
        .await
        {
            Ok(result) => {
                let id = UserIdT::new(result.last_insert_id);
                self.users.insert(
                    id,
                    UserData {
                        id,
                        name: name.to_string(),
                        is_driver,
                        is_disponent,
                        company_id: company,
                        is_admin,
                        email: email.to_string(),
                        password,
                        salt: salt.to_string(),
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

    async fn create_availability(
        &mut self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle: VehicleIdT,
    ) -> StatusCode {
        let mut interval = Interval::new(start_time, end_time);
        if !is_valid(&interval) {
            return StatusCode::NOT_ACCEPTABLE;
        }
        if !vehicle.is_in_range(1, self.max_vehicle_id()) {
            return StatusCode::NOT_FOUND;
        }
        self.vehicles[vehicle.as_idx()]
            .add_availability(&self.db_connection, &mut interval, None)
            .await
    }

    async fn create_zone(
        &mut self,
        name: &str,
        area_str: &str,
    ) -> StatusCode {
        if self.zones.iter().any(|zone| zone.name == name) {
            return StatusCode::CONFLICT;
        }
        let area = match multi_polygon_from_str(area_str) {
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
        .exec(&self.db_connection)
        .await
        {
            Err(e) => {
                error!("{e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
            Ok(result) => {
                self.zones.push(ZoneData {
                    id: ZoneIdT::new(result.last_insert_id),
                    area,
                    name: name.to_string(),
                });
                StatusCode::CREATED
            }
        }
    }

    async fn create_company(
        &mut self,
        name: &str,
        zone: ZoneIdT,
        email: &str,
        lat: f32,
        lng: f32,
    ) -> StatusCode {
        if self.max_zone_id() < zone.id() {
            return StatusCode::EXPECTATION_FAILED;
        }
        if self.companies.iter().any(|company| company.email == email) {
            return StatusCode::CONFLICT;
        }
        match Company::insert(company::ActiveModel {
            id: ActiveValue::NotSet,
            longitude: ActiveValue::Set(lng),
            latitude: ActiveValue::Set(lat),
            display_name: ActiveValue::Set(name.to_string()),
            zone: ActiveValue::Set(zone.id()),
            email: ActiveValue::Set(email.to_string()),
        })
        .exec(&self.db_connection)
        .await
        {
            Ok(result) => {
                self.companies.push(CompanyData {
                    id: CompanyIdT::new(result.last_insert_id),
                    central_coordinates: Point::new(lng as f64, lat as f64),
                    zone,
                    name: name.to_string(),
                    email: email.to_string(),
                });
                StatusCode::CREATED
            }
            Err(e) => {
                error!("{e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
    }

    async fn remove_availability(
        &mut self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle_id: VehicleIdT,
    ) -> StatusCode {
        match self.is_vehicle_idle(vehicle_id, start_time, end_time).await {
            Ok(idle) => {
                if !idle {
                    return StatusCode::NOT_ACCEPTABLE;
                }
            }
            Err(e) => return e,
        }
        let to_remove_interval = Interval::new(start_time, end_time);
        if !is_valid(&to_remove_interval) {
            return StatusCode::NOT_ACCEPTABLE;
        }
        let mut mark_delete: Vec<i32> = Vec::new();
        let mut to_insert = Vec::<Interval>::new();
        let vehicle = &mut self.vehicles[vehicle_id.as_idx()];
        let mut altered = false;
        for (id, existing) in vehicle.availability.iter_mut() {
            if !existing.interval.overlaps(&to_remove_interval) {
                continue;
            }
            altered = true;
            if to_remove_interval.contains(&existing.interval) {
                mark_delete.push(*id);
                continue;
            }
            if existing.interval.contains(&to_remove_interval) {
                mark_delete.push(*id);
                let (left, right) = existing.interval.split(&to_remove_interval);
                to_insert.push(left);
                to_insert.push(right);
                break;
            }
            if to_remove_interval.overlaps(&existing.interval) {
                mark_delete.push(*id);
                to_insert.push(existing.interval.cut(&to_remove_interval));
            }
        }
        if !altered {
            return StatusCode::NO_CONTENT; //no error occured but the transmitted interval did not touch any availabilites for the transmitted vehicle
        }
        for to_delete in mark_delete {
            match Availability::delete_by_id(vehicle.availability[&to_delete].id)
                .exec(&self.db_connection)
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
        for insert_interval in to_insert.iter() {
            self.create_availability(
                insert_interval.start_time,
                insert_interval.end_time,
                vehicle_id,
            )
            .await;
        }
        StatusCode::OK
    }

    async fn change_vehicle_for_tour(
        &mut self,
        tour_id: TourIdT,
        new_vehicle_id: VehicleIdT,
    ) -> StatusCode {
        //TODO ensure that vehicle also is able to approach and return in time
        if !new_vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return StatusCode::NOT_FOUND;
        }
        let old_vehicle_id = match self.get_tour(tour_id).await {
            Ok(tour) => tour.vehicle,
            Err(e) => return e,
        };
        if old_vehicle_id == new_vehicle_id {
            return StatusCode::NO_CONTENT;
        }
        let tour_idx = self.vehicles[old_vehicle_id.as_idx()]
            .tours
            .iter()
            .enumerate()
            .find(|(_, tour)| tour.id == tour_id)
            .map(|(pos, _)| pos)
            .unwrap();
        let tour = &self.vehicles[old_vehicle_id.as_idx()].tours[tour_idx];
        let first_event_opt = tour.events.iter().min_by_key(|event| event.scheduled_time);
        let last_event_opt = tour.events.iter().max_by_key(|event| event.scheduled_time);
        let new_vehicle_company_coordinates = Coord::from(
            self.companies[self.vehicles[new_vehicle_id.as_idx()].company.as_idx()]
                .central_coordinates,
        );
        let (approach_duration_res, return_duration_res) = match (first_event_opt, last_event_opt) {
            (None, None) => return StatusCode::INTERNAL_SERVER_ERROR,
            (Some(_), None) => return StatusCode::INTERNAL_SERVER_ERROR,
            (None, Some(_)) => return StatusCode::INTERNAL_SERVER_ERROR,
            (Some(first), Some(last)) => (
                self.osrm
                    .one_to_many(
                        Coord::from(first.coordinates),
                        vec![new_vehicle_company_coordinates],
                        Forward,
                    )
                    .await,
                self.osrm
                    .one_to_many(
                        Coord::from(last.coordinates),
                        vec![new_vehicle_company_coordinates],
                        Backward,
                    )
                    .await,
            ),
        };
        let (approach_duration, return_duration) =
            match (approach_duration_res, return_duration_res) {
                (Err(e1), Err(e2)) => {
                    error!("{} and {}", e1, e2);
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
                (Ok(_), Err(e2)) => {
                    error!("{}", e2);
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
                (Err(e1), Ok(_)) => {
                    error!("{}", e1);
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
                (Ok(approach), Ok(ret)) => (
                    seconds_to_minutes_duration(approach[0].time),
                    seconds_to_minutes_duration(ret[0].time),
                ),
            };
        if !self.may_vehicle_operate_during::<true, true>(
            &self.vehicles[new_vehicle_id.as_idx()],
            &Interval::new(
                tour.departure - approach_duration,
                tour.arrival + return_duration,
            ),
        ) {
            return StatusCode::NOT_ACCEPTABLE;
        }
        let mut moved_tour = self.vehicles[old_vehicle_id.as_idx()]
            .tours
            .remove(tour_idx);
        moved_tour.vehicle = new_vehicle_id;
        self.vehicles[new_vehicle_id.as_idx()]
            .tours
            .push(moved_tour);

        let mut active_m: tour::ActiveModel = match Tour::find_by_id(tour_id.id())
            .one(&self.db_connection)
            .await
        {
            Err(e) => {
                error!("{e:?}");
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
            Ok(m) => match m {
                None => return StatusCode::INTERNAL_SERVER_ERROR,
                Some(model) => (model as tour::Model).into(),
            },
        };
        active_m.vehicle = ActiveValue::Set(new_vehicle_id.id());
        match active_m.update(&self.db_connection).await {
            Ok(_) => (),
            Err(e) => {
                error!("{}", e);
                return StatusCode::INTERNAL_SERVER_ERROR;
            }
        }
        StatusCode::OK
    }

    async fn get_company(
        &self,
        company_id: &CompanyIdT,
    ) -> Result<Box<&dyn PrimaCompany>, StatusCode> {
        if !company_id.is_in_range(1, self.max_company_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Box::new(
            self.companies
                .iter()
                .find(|company| &company.id == company_id)
                .unwrap() as &dyn PrimaCompany,
        ))
    }

    async fn get_user(
        &self,
        user_id: UserIdT,
    ) -> Result<Box<&dyn PrimaUser>, StatusCode> {
        if !self.users.contains_key(&user_id) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(Box::new(&self.users[&user_id] as &dyn PrimaUser))
    }

    async fn get_tours(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&'_ dyn PrimaTour>>, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self.vehicles[vehicle_id.as_idx()]
            .tours
            .iter()
            .filter(|tour| tour.overlaps(&Interval::new(time_frame_start, time_frame_end)))
            .map(|tour| Box::new(tour as &dyn PrimaTour))
            .collect_vec())
    }

    async fn get_events_for_vehicle(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&'_ dyn PrimaEvent>>, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let interval = Interval::new(time_frame_start, time_frame_end);
        Ok(self.vehicles[vehicle_id.as_idx()]
            .tours
            .iter()
            .flat_map(|tour| &tour.events)
            .filter(|event| event.overlaps(&interval))
            .map(|event| Box::new(event as &'_ dyn PrimaEvent))
            .collect_vec())
    }

    async fn get_vehicles(
        &self,
        company_id: CompanyIdT,
    ) -> Result<Vec<Box<&'_ dyn PrimaVehicle>>, StatusCode> {
        if !company_id.is_in_range(1, self.max_company_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self
            .vehicles
            .iter()
            .filter(|vehicle| vehicle.company == company_id)
            .map(|vehicle| Box::new(vehicle as &'_ dyn PrimaVehicle))
            .collect_vec())
    }

    async fn get_events_for_user(
        &self,
        user_id: UserIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&'_ dyn PrimaEvent>>, StatusCode> {
        if !self.users.contains_key(&user_id) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(self
            .vehicles
            .iter()
            .flat_map(|vehicle| vehicle.tours.iter().flat_map(|tour| &tour.events))
            .filter(|event| {
                event.overlaps(&Interval::new(time_frame_start, time_frame_end))
                    && event.customer == user_id
            })
            .map(|event| Box::new(event as &dyn PrimaEvent))
            .collect_vec())
    }

    async fn get_idle_vehicles(
        &self,
        company_id: CompanyIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<Box<&'_ dyn PrimaVehicle>>, StatusCode> {
        if !company_id.is_in_range(1, self.max_company_id()) {
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
                    && !vehicle
                        .tours
                        .iter()
                        .filter(|tour| (consider_provided_tour_conflict || tour_id != tour.id))
                        .any(|tour| tour.overlaps(&tour_interval))
            })
            .map(|vehicle| Box::new(vehicle as &dyn PrimaVehicle))
            .collect_vec())
    }

    async fn is_vehicle_idle(
        &self,
        vehicle_id: VehicleIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<bool, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };
        Ok(!self.vehicles[vehicle_id.as_idx()]
            .tours
            .iter()
            .filter(|tour| (consider_provided_tour_conflict || tour_id != tour.id))
            .any(|tour| tour.overlaps(&tour_interval)))
    }

    //return vectors of conflicting tours by vehicle ids as keys
    //does not consider the provided tour_id as a conflict
    async fn get_company_conflicts(
        &self,
        company_id: CompanyIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<HashMap<VehicleIdT, Vec<Box<&'_ dyn PrimaTour>>>, StatusCode> {
        if !company_id.is_in_range(1, self.max_company_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let provided_tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };

        let mut ret = HashMap::<VehicleIdT, Vec<Box<&dyn PrimaTour>>>::new();
        self.vehicles
            .iter()
            .filter(|vehicle| vehicle.company == company_id)
            .for_each(|vehicle| {
                let conflicts = vehicle
                    .tours
                    .iter()
                    .filter(|tour| {
                        (consider_provided_tour_conflict || tour_id != tour.id)
                            && tour.overlaps(&provided_tour_interval)
                    })
                    .map(|tour| Box::new(tour as &dyn PrimaTour))
                    .collect_vec();
                if !conflicts.is_empty() {
                    ret.insert(vehicle.id, conflicts);
                }
            });
        Ok(ret)
    }

    //does not consider the provided tour_id as a conflict
    async fn get_vehicle_conflicts(
        &self,
        vehicle_id: VehicleIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<Box<&'_ dyn PrimaTour>>, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let tour_interval = match self.get_tour(tour_id).await {
            Ok(t) => Interval::new(t.departure, t.arrival),
            Err(code) => return Err(code),
        };
        Ok(self.vehicles[vehicle_id.as_idx()]
            .tours
            .iter()
            .filter(|tour| {
                (consider_provided_tour_conflict || tour_id != tour.id)
                    && tour.overlaps(&tour_interval)
            })
            .map(|tour| Box::new(tour as &dyn PrimaTour))
            .collect_vec())
    }

    async fn get_tour_conflicts(
        &self,
        event_id: EventIdT,
        company_id: Option<CompanyIdT>,
    ) -> Result<Vec<Box<&'_ dyn PrimaTour>>, StatusCode> {
        if self
            .vehicles
            .iter()
            .flat_map(|vehicle| vehicle.tours.iter().flat_map(|tour| &tour.events))
            .any(|event| event_id == event.id)
        {
            return Err(StatusCode::NOT_FOUND);
        }
        match company_id {
            None => (),
            Some(id) => {
                if !id.is_in_range(1, self.max_company_id()) {
                    return Err(StatusCode::NOT_FOUND);
                }
            }
        }
        let event = match self.find_event(event_id).await {
            None => return Err(StatusCode::NOT_FOUND),
            Some(e) => e,
        };
        Ok(self
            .vehicles
            .iter()
            .filter(|vehicle| match company_id {
                None => true,
                Some(id) => vehicle.company == id,
            })
            .flat_map(|vehicle| &vehicle.tours)
            .filter(|tour| {
                tour.overlaps(&Interval::new(
                    event.communicated_time,
                    event.scheduled_time,
                ))
            })
            .map(|tour| Box::new(tour as &dyn PrimaTour))
            .collect_vec())
    }

    async fn get_events_for_tour(
        &self,
        tour_id: TourIdT,
    ) -> Result<Vec<Box<&'_ dyn PrimaEvent>>, StatusCode> {
        match self.get_tour(tour_id).await {
            Err(e) => return Err(e),
            Ok(tour) => {
                return Ok(tour
                    .events
                    .iter()
                    .map(|event| Box::new(event as &dyn PrimaEvent))
                    .collect_vec())
            }
        };
    }

    async fn is_vehicle_available(
        &self,
        vehicle_id: VehicleIdT,
        tour_id: TourIdT,
    ) -> Result<bool, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let vehicle = &self.vehicles[vehicle_id.as_idx()];
        let tour = match vehicle.tours.iter().find(|tour| tour.id == tour_id) {
            Some(t) => t,
            None => return Err(StatusCode::NOT_FOUND),
        };
        let tour_interval = Interval::new(tour.departure, tour.arrival);
        Ok(vehicle
            .availability
            .iter()
            .any(|(_, availability)| availability.interval.contains(&tour_interval)))
    }

    async fn get_availability_intervals(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<&Interval>, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        Ok(match self
            .vehicles
            .iter()
            .find(|vehicle| vehicle.id == vehicle_id)
        {
            Some(v) => v,
            None => return Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
        .availability
        .values()
        .map(|availability| &availability.interval)
        .filter(|availability_interval| {
            Interval::new(time_frame_start, time_frame_end).overlaps(availability_interval)
        })
        .collect_vec())
    }
} // end of PrimaData Trait implementation

impl Data {
    pub fn new(db_connection: &DbConn) -> Self {
        Self {
            zones: Vec::<ZoneData>::new(),
            companies: Vec::<CompanyData>::new(),
            vehicles: Vec::<VehicleData>::new(),
            users: HashMap::<UserIdT, UserData>::new(),
            addresses: Vec::new(),
            db_connection: db_connection.clone(),
            osrm: OSRM::new(),
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn print(&self) {
        let indent = "  ";
        println!("printing zones:");
        self.print_zones(indent);
        println!("printing companies:");
        self.print_companies(indent);
        println!("printing vehicles:");
        self.print_vehicles(true, indent);
        println!("printing tours:");
        self.print_tours(true, indent);
        println!("printing addresses:");
        self.print_addresses(indent);
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn print_addresses(
        &self,
        indent: &str,
    ) {
        for a in self.addresses.iter() {
            a.print(indent);
        }
    }

    async fn insert_request_into_db(
        &mut self,
        passengers: i32,
        wheelchairs: i32,
        luggage: i32,
        customer: &UserIdT,
        tour: &TourIdT,
    ) -> Result<i32, StatusCode> {
        if passengers < 0 || wheelchairs < 0 || luggage < 0 {
            return Err(StatusCode::EXPECTATION_FAILED);
        }
        if !self.users.keys().contains(&customer) {
            return Err(StatusCode::CONFLICT);
        }
        match Request::insert(request::ActiveModel {
            id: ActiveValue::NotSet,
            tour: ActiveValue::Set(tour.id()),
            customer: ActiveValue::Set(customer.id()),
            passengers: ActiveValue::Set(passengers),
            wheelchairs: ActiveValue::Set(wheelchairs),
            luggage: ActiveValue::Set(luggage),
        })
        .exec(&self.db_connection)
        .await
        {
            Ok(result) => Ok(result.last_insert_id),
            Err(e) => {
                error!("{e:?}");
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    fn print_tours(
        &self,
        print_events: bool,
        indent: &str,
    ) {
        let mut event_indent = "  ".to_string();
        event_indent.push_str(indent);
        for tour in self.vehicles.iter().flat_map(|vehicle| &vehicle.tours) {
            tour.print(indent);
            if print_events {
                println!("{}printing events:", event_indent);
                for event in tour.events.iter() {
                    if tour.id != event.tour {
                        continue;
                    }

                    event.print(&event_indent);
                }
            }
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn print_zones(
        &self,
        indent: &str,
    ) {
        for z in &self.zones {
            z.print(indent);
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn print_companies(
        &self,
        indent: &str,
    ) {
        for c in &self.companies {
            c.print(indent);
        }
    }

    #[cfg(test)]
    #[allow(dead_code)]
    pub fn print_vehicles(
        &self,
        print_availabilities: bool,
        indent: &str,
    ) {
        let mut availability_indent = "  ".to_string();
        availability_indent.push_str(indent);
        for v in &self.vehicles {
            v.print(indent);
            if print_availabilities {
                println!("{}printing availabilites:", availability_indent);
                for availability in v.availability.values() {
                    availability.print(&availability_indent);
                }
            }
        }
    }

    #[cfg(test)]
    fn max_event_id(&self) -> i32 {
        self.vehicles
            .iter()
            .flat_map(|vehicle| vehicle.tours.iter().flat_map(|tour| &tour.events))
            .map(|event| event.id.id())
            .max()
            .unwrap_or(0)
    }

    fn max_company_id(&self) -> i32 {
        self.companies.len() as i32
    }

    fn max_zone_id(&self) -> i32 {
        self.zones.len() as i32
    }

    fn max_vehicle_id(&self) -> i32 {
        self.vehicles.len() as i32
    }

    #[cfg(test)]
    fn get_n_availabilities(&self) -> usize {
        self.vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.availability)
            .count()
    }

    fn get_n_tours(&self) -> i32 {
        self.vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.tours)
            .count() as i32
    }

    async fn is_vehicle_idle(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<bool, StatusCode> {
        if !vehicle_id.is_in_range(1, self.max_vehicle_id()) {
            return Err(StatusCode::NOT_FOUND);
        }
        let interval = Interval::new(time_frame_start, time_frame_end);
        Ok(!self.vehicles[vehicle_id.as_idx()]
            .tours
            .iter()
            .any(|tour| tour.overlaps(&interval)))
    }

    async fn find_or_create_address(
        &mut self,
        add: &str,
    ) -> Result<i32, StatusCode> {
        match self.addresses.iter().find(|a| a.address == add) {
            Some(a) => Ok(a.id),
            None => {
                match Address::insert(address::ActiveModel {
                    id: ActiveValue::NotSet,
                    address: ActiveValue::Set(add.to_string()),
                })
                .exec(&self.db_connection)
                .await
                {
                    Err(_) => Err(StatusCode::BAD_GATEWAY),
                    Ok(result) => {
                        let id = result.last_insert_id;
                        let a = AddressData {
                            id,
                            address: add.to_string(),
                        };
                        self.addresses.push(a);
                        Ok(id)
                    }
                }
            }
        }
    }

    // TODO: use enum for generics when this feature is stable
    fn may_vehicle_operate_during<
        const COMPARE_START_FROM_CENTRAL: bool,
        const COMPARE_TARGET_FROM_CENTRAL: bool,
    >(
        &self,
        vehicle: &VehicleData,
        interval: &Interval,
    ) -> bool {
        vehicle
            .availability
            .values()
            .any(|availability| availability.interval.contains(interval))
            && !vehicle.tours.iter().any(|tour| {
                match (COMPARE_START_FROM_CENTRAL, COMPARE_TARGET_FROM_CENTRAL) {
                    (false, false) => tour
                        .events
                        .iter()
                        .any(|event| interval.contains_point(&event.scheduled_time)),
                    (true, false) => {
                        interval.start_time < tour.departure
                            && tour
                                .events
                                .iter()
                                .any(|event| interval.contains_point(&event.scheduled_time))
                    }
                    (false, true) => {
                        interval.end_time > tour.arrival
                            && tour
                                .events
                                .iter()
                                .any(|event| interval.contains_point(&event.scheduled_time))
                    }
                    (true, true) => tour.overlaps(interval),
                }
            })
    }

    //TODO: remove pub when events can be created by handling routing requests
    #[allow(clippy::too_many_arguments)]
    pub async fn insert_or_addto_tour(
        &mut self,
        tour_id: Option<TourIdT>, // tour_id == None <=> tour already exists
        departure: NaiveDateTime,
        arrival: NaiveDateTime,
        vehicle: VehicleIdT,
        start_address: &str,
        target_address: &str,
        lat_start: f32,
        lng_start: f32,
        sched_t_start: NaiveDateTime,
        comm_t_start: NaiveDateTime,
        customer: UserIdT,
        passengers: i32,
        wheelchairs: i32,
        luggage: i32,
        lat_target: f32,
        lng_target: f32,
        sched_t_target: NaiveDateTime,
        comm_t_target: NaiveDateTime,
    ) -> StatusCode {
        if !is_valid(&Interval::new(departure, arrival))
            || !is_valid(&Interval::new(sched_t_start, sched_t_target))
        {
            return StatusCode::NOT_ACCEPTABLE;
        }
        if !self.users.contains_key(&customer) || self.max_vehicle_id() < vehicle.id() {
            return StatusCode::EXPECTATION_FAILED;
        }
        let id = match tour_id {
            Some(t_id) => {
                if self.get_n_tours() < t_id.id() {
                    return StatusCode::EXPECTATION_FAILED;
                }
                t_id
            }
            None => {
                let t_id = TourIdT::new(
                    match Tour::insert(tour::ActiveModel {
                        id: ActiveValue::NotSet,
                        departure: ActiveValue::Set(departure),
                        arrival: ActiveValue::Set(arrival),
                        vehicle: ActiveValue::Set(vehicle.id()),
                    })
                    .exec(&self.db_connection)
                    .await
                    {
                        Ok(result) => result.last_insert_id,
                        Err(e) => {
                            error!("Error creating tour: {e:?}");
                            return StatusCode::INTERNAL_SERVER_ERROR;
                        }
                    },
                );
                (self.vehicles[vehicle.as_idx()]).tours.push(TourData {
                    id: t_id,
                    departure,
                    arrival,
                    vehicle,
                    events: Vec::new(),
                });
                t_id
            }
        };
        let start_address_id = self.find_or_create_address(start_address).await.unwrap();
        let target_address_id = self.find_or_create_address(target_address).await.unwrap();
        let request_id = match self
            .insert_request_into_db(passengers, wheelchairs, luggage, &customer, &id)
            .await
        {
            Err(e) => return e,
            Ok(r_id) => r_id,
        };

        let pickup_event_id = EventIdT::new(
            match Event::insert(event::ActiveModel {
                id: ActiveValue::NotSet,
                longitude: ActiveValue::Set(lng_start),
                latitude: ActiveValue::Set(lat_start),
                scheduled_time: ActiveValue::Set(sched_t_start),
                communicated_time: ActiveValue::Set(comm_t_start),
                request: ActiveValue::Set(request_id),
                is_pickup: ActiveValue::Set(true),
                address: ActiveValue::Set(start_address_id),
            })
            .exec(&self.db_connection)
            .await
            {
                Ok(pickup_result) => pickup_result.last_insert_id,
                Err(e) => {
                    error!("Error creating event: {e:?}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            },
        );
        let dropoff_event_id = EventIdT::new(
            match Event::insert(event::ActiveModel {
                id: ActiveValue::NotSet,
                longitude: ActiveValue::Set(lng_target),
                latitude: ActiveValue::Set(lat_target),
                scheduled_time: ActiveValue::Set(sched_t_target),
                communicated_time: ActiveValue::Set(comm_t_target),
                request: ActiveValue::Set(request_id),
                is_pickup: ActiveValue::Set(false),
                address: ActiveValue::Set(target_address_id),
            })
            .exec(&self.db_connection)
            .await
            {
                Ok(dropoff_result) => dropoff_result.last_insert_id,
                Err(e) => {
                    error!("Error creating event: {e:?}");
                    return StatusCode::INTERNAL_SERVER_ERROR;
                }
            },
        );
        let tour = &mut self.vehicles[vehicle.as_idx()].get_tour(&id).await.unwrap();
        let events = &mut tour.events;
        //pickup-event
        events.push(EventData {
            coordinates: Point::new(lng_start as f64, lat_start as f64),
            scheduled_time: sched_t_start,
            communicated_time: comm_t_start,
            customer,
            tour: id,
            passengers,
            wheelchairs,
            luggage,
            request_id,
            id: pickup_event_id,
            is_pickup: true,
            address_id: AddressIdT::new(start_address_id),
        });
        //dropoff-event
        events.push(EventData {
            coordinates: Point::new(lng_target as f64, lat_target as f64),
            scheduled_time: sched_t_target,
            communicated_time: comm_t_target,
            customer,
            tour: id,
            passengers,
            wheelchairs,
            luggage,
            request_id,
            id: dropoff_event_id,
            is_pickup: false,
            address_id: AddressIdT::new(target_address_id),
        });
        StatusCode::CREATED
    }

    async fn get_candidate_vehicles(
        &self,
        passengers: i32,
        start: &Point,
    ) -> Vec<&VehicleData> {
        let zones_containing_start_point_ids = self
            .zones
            .iter()
            .filter(|zone| zone.area.contains(start))
            .map(|zone| &zone.id)
            .collect_vec();
        let mut candidate_vehicles = Vec::<&VehicleData>::new();
        for (company_id, vehicles) in self
            .vehicles
            .iter()
            .group_by(|vehicle| &vehicle.company)
            .into_iter()
        {
            if !zones_containing_start_point_ids
                .contains(&&self.companies[company_id.as_idx()].zone)
            {
                continue;
            }
            candidate_vehicles.append(
                &mut vehicles
                    .filter(|vehicle| vehicle.fulfills_requirements(passengers))
                    .collect_vec(),
            );
        }
        candidate_vehicles
    }

    #[cfg(test)]
    async fn get_start_point_viable_companies(
        &self,
        start: &Point,
    ) -> Vec<&CompanyData> {
        let viable_zone_ids = self.get_zones_containing_point_ids(start).await;
        self.companies
            .iter()
            .filter(|company| viable_zone_ids.contains(&&company.zone))
            .collect_vec()
    }

    #[cfg(test)]
    async fn get_zones_containing_point_ids(
        &self,
        start: &Point,
    ) -> Vec<&ZoneIdT> {
        self.zones
            .iter()
            .filter(|zone| zone.area.contains(start))
            .map(|zone| &zone.id)
            .collect_vec()
    }

    async fn get_tour(
        &self,
        tour_id: TourIdT,
    ) -> Result<&TourData, StatusCode> {
        match self
            .vehicles
            .iter()
            .flat_map(|vehicle| &vehicle.tours)
            .find(|tour| tour.id == tour_id)
        {
            Some(t) => Ok(t),
            None => Err(StatusCode::NOT_FOUND),
        }
    }

    async fn find_event(
        &self,
        event_id: EventIdT,
    ) -> Option<&EventData> {
        self.vehicles
            .iter()
            .flat_map(|vehicle| vehicle.tours.iter().flat_map(|tour| &tour.events))
            .find(|event| event.id == event_id)
    }

    #[allow(dead_code)]
    fn tour_count(&self) -> usize {
        self.vehicles.iter().flat_map(|v| &v.tours).count()
    }
}

#[cfg(test)]
mod test {
    use super::ZoneData;
    use crate::{
        backend::{
            data::{beeline_duration, Data},
            id_types::{CompanyIdT, IdT, TourIdT, UserIdT, VehicleIdT, ZoneIdT},
            lib::PrimaData,
        },
        constants::{geo_points::TestPoints, gorlitz::GORLITZ},
        dotenv, env,
        init::{init, InitType},
        Database, Migrator,
    };
    use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
    use geo::{Contains, Point};
    use hyper::StatusCode;
    use itertools::Itertools;
    use migration::MigratorTrait;
    use serial_test::serial;
    use tracing_test::traced_test;

    async fn check_zones_contain_correct_points(
        d: &Data,
        points: &[Point],
        expected_zones: i32,
    ) {
        for point in points.iter() {
            let companies_containing_point = d.get_start_point_viable_companies(point).await;
            for company in &d.companies {
                if companies_containing_point.contains(&company) {
                    assert!(company.zone.id() == expected_zones);
                } else {
                    assert!(company.zone.id() != expected_zones);
                }
            }
        }
    }

    fn check_points_in_zone(
        expect: bool,
        zone: &ZoneData,
        points: &[Point],
    ) {
        for point in points.iter() {
            assert_eq!(zone.area.contains(point), expect);
        }
    }

    async fn check_data_db_synchronized(data: &Data) {
        let mut read_data = Data::new(&data.db_connection);
        read_data.read_data_from_db().await;
        assert!(read_data == *data);
    }

    async fn insert_or_add_test_tour(
        data: &mut Data,
        vehicle_id: VehicleIdT,
    ) -> StatusCode {
        data.insert_or_addto_tour(
            None,
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(9, 10, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(10, 0, 0)
                .unwrap(),
            vehicle_id,
            "karolinenplatz 5",
            "Lichtwiesenweg 3",
            13.867512,
            51.22069,
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            UserIdT::new(2),
            3,
            0,
            0,
            14.025081,
            51.195075,
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(9, 55, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(5000, 4, 15)
                .unwrap()
                .and_hms_opt(9, 18, 0)
                .unwrap(),
        )
        .await
    }

    async fn test_main() {
        dotenv().ok();
        let db_url = env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
        let conn = Database::connect(db_url)
            .await
            .expect("Database connection failed");
        Migrator::up(&conn, None).await.unwrap();
    }

    #[tokio::test]
    #[serial]
    async fn test_zones() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;
        let test_points = TestPoints::new();
        //Validate invalid multipolygon handling when creating zone (expect StatusCode::BAD_REQUEST)
        assert_eq!(
            d.create_zone("some new zone name", "invalid multipolygon")
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
    }

    #[tokio::test]
    #[serial]
    async fn test_synchronization() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;
        check_data_db_synchronized(&d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_key_violations() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;
        //validate UniqueKeyViolation handling when creating data (expect StatusCode::CONFLICT)
        //unique keys:  table               keys
        //              user                name, email
        //              zone                name
        //              company             name
        //              vehicle             license-plate
        let mut n_users = d.users.len();
        //insert user with existing name
        assert_eq!(
            d.create_user(
                "TestDriver1",
                true,
                false,
                Some(CompanyIdT::new(1)),
                false,
                "test@gmail.com",
                Some("".to_string()),
                "",
                Some("".to_string()),
                Some("".to_string()),
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.users.len(), n_users + 1);
        n_users = d.users.len();
        //insert user with existing email
        assert_eq!(
            d.create_user(
                "TestDriver2",
                true,
                false,
                Some(CompanyIdT::new(2)),
                false,
                "test@aol.com",
                Some("".to_string()),
                "",
                Some("".to_string()),
                Some("".to_string()),
            )
            .await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.users.len(), n_users);
        //insert user with new name and email
        assert_eq!(
            d.create_user(
                "TestDriver2",
                false,
                false,
                None,
                false,
                "test@gmail2.com",
                Some("".to_string()),
                "",
                Some("".to_string()),
                Some("".to_string()),
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.users.len(), n_users + 1);

        //insert zone with existing name
        let n_zones = d.zones.len();
        assert_eq!(
            d.create_zone("Görlitz", GORLITZ).await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.zones.len(), n_zones);

        //insert company with existing name
        let mut n_companies = d.companies.len();
        assert_eq!(
            d.create_company(
                "Taxi-Unternehmen Bautzen-1",
                ZoneIdT::new(1),
                "mustermann@web.de",
                1.0,
                1.0
            )
            .await,
            StatusCode::CREATED
        );

        //insert vehicle with existing license plate
        let n_vehicles = d.vehicles.len();
        assert_eq!(
            d.create_vehicle("TUB1-1", CompanyIdT::new(1)).await,
            StatusCode::CONFLICT
        );
        assert_eq!(d.vehicles.len(), n_vehicles);

        //Validate ForeignKeyViolation handling when creating data (expect StatusCode::EXPECTATION_FAILED)
        //foreign keys: table               keys
        //              company             zone
        //              vehicle             company
        //              availability        vehicle
        //              tour                vehicle
        //              event               user tour
        let n_tours = d.get_n_tours();
        let n_events = d.max_event_id();
        assert_eq!(
            insert_or_add_test_tour(&mut d, VehicleIdT::new(100)).await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(
            insert_or_add_test_tour(&mut d, VehicleIdT::new(100)).await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(n_events, d.max_event_id());
        assert_eq!(n_tours, d.get_n_tours());
        //insert company with non-existing zone
        assert_eq!(
            d.create_company(
                "some new name",
                ZoneIdT::new(1 + n_zones as i32),
                "y@x",
                1.0,
                1.0
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(d.companies.len(), n_companies + 1);
        n_companies = d.companies.len();
        //insert company with existing zone
        assert_eq!(
            d.create_company(
                "some new name",
                ZoneIdT::new(n_zones as i32),
                "x@z",
                1.0,
                1.0
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.companies.len(), n_companies + 1);
        let n_companies = d.companies.len();

        //insert company with existing email
        assert_eq!(
            d.create_company(
                "some new name",
                ZoneIdT::new(n_zones as i32),
                "a@b",
                1.0,
                1.0
            )
            .await,
            StatusCode::CONFLICT
        );
        //insert vehicle with non-existing company
        assert_eq!(
            d.create_vehicle(
                "some new license plate",
                CompanyIdT::new(1 + n_companies as i32)
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );
        assert_eq!(d.vehicles.len(), n_vehicles);
        //insert vehicle with existing company
        assert_eq!(
            d.create_vehicle(
                "some new license plate",
                CompanyIdT::new(n_companies as i32)
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.vehicles.len(), n_vehicles + 1);

        check_data_db_synchronized(&d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_invalid_interval_parameter_handling() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let base_time = NaiveDate::from_ymd_opt(5000, 1, 1)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();

        //interval range not limited
        assert!(d
            .get_tours(VehicleIdT::new(1), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await
            .is_ok());
        //interval range not limited
        assert!(d
            .get_events_for_user(UserIdT::new(1), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await
            .is_ok());

        //interval range not limited
        //assert!(d.get_events_for_tour(1).await.is_ok()); no tour right now

        //interval range not limited
        assert!(d
            .get_events_for_vehicle(VehicleIdT::new(1), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await
            .is_ok());
        let n_availabilities = d.get_n_availabilities();
        //starttime before year 2024
        assert_eq!(
            d.create_availability(
                NaiveDateTime::MIN,
                base_time + Duration::hours(1),
                VehicleIdT::new(1)
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities);
        //endtime after year 100000
        assert_eq!(
            d.create_availability(
                base_time,
                NaiveDate::from_ymd_opt(100000, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                VehicleIdT::new(1)
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities);
        //starttime before year 2024
        assert_eq!(
            d.remove_availability(
                NaiveDate::from_ymd_opt(2023, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                VehicleIdT::new(1)
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        //endtime after year 100000
        assert_eq!(
            d.remove_availability(
                NaiveDate::from_ymd_opt(2024, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(100000, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                VehicleIdT::new(1)
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities);

        check_data_db_synchronized(&d).await;
    }

    #[tokio::test]
    #[serial]
    async fn test_init() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        assert_eq!(d.vehicles.len(), 5);
        assert_eq!(d.zones.len(), 3);
        assert_eq!(d.companies.len(), 3);
        assert_eq!(d.vehicles.iter().flat_map(|v| &v.availability).count(), 3);
    }

    #[tokio::test]
    #[serial]
    async fn availability_test() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let base_time = NaiveDate::from_ymd_opt(5000, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap();
        let in_2_hours = base_time + Duration::hours(2);
        let in_3_hours = base_time + Duration::hours(3);

        assert_eq!(d.vehicles[0].availability.len(), 1);
        //try removing availability created in init (needed for tour)
        assert_eq!(
            d.remove_availability(
                NaiveDate::from_ymd_opt(5000, 1, 1)
                    .unwrap()
                    .and_hms_opt(0, 0, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(5005, 1, 1)
                    .unwrap()
                    .and_hms_opt(0, 0, 0)
                    .unwrap(),
                VehicleIdT::new(1),
            )
            .await,
            StatusCode::OK
        );

        assert_eq!(d.vehicles[0].availability.len(), 0);
        //add non-touching
        assert_eq!(
            d.create_availability(in_2_hours, in_3_hours, VehicleIdT::new(1))
                .await,
            StatusCode::CREATED
        );
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //add touching
        assert_eq!(
            d.create_availability(
                in_2_hours + Duration::hours(1),
                in_3_hours + Duration::hours(1),
                VehicleIdT::new(1),
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //add containing/contained (equal)
        assert_eq!(
            d.create_availability(in_2_hours, in_3_hours, VehicleIdT::new(1))
                .await,
            StatusCode::OK
        );
        assert_eq!(d.vehicles[0].availability.len(), 1);

        //remove non-touching
        d.remove_availability(
            base_time + Duration::weeks(1),
            base_time + Duration::weeks(2),
            VehicleIdT::new(1),
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);
        //remove split
        d.remove_availability(
            in_2_hours + Duration::minutes(5),
            in_3_hours - Duration::minutes(5),
            VehicleIdT::new(1),
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 2);
        //remove overlapping
        d.remove_availability(
            in_2_hours - Duration::minutes(90),
            in_3_hours - Duration::minutes(100),
            VehicleIdT::new(1),
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 2);
        //remove containing
        d.remove_availability(
            in_2_hours,
            in_2_hours + Duration::minutes(5),
            VehicleIdT::new(1),
        )
        .await;
        assert_eq!(d.vehicles[0].availability.len(), 1);
    }

    #[tokio::test]
    #[serial]
    async fn get_events_for_vehicle_test() {
        test_main().await;
        let d = init(true, InitType::BackendTestWithEvents).await;

        // vehicle       # of events created in init
        //   1                  4
        //   2                  2
        //   3                  0
        //   4                  0

        let not_found_result = d
            .get_events_for_vehicle(
                VehicleIdT::new(1 + d.vehicles.len() as i32),
                NaiveDateTime::MIN,
                NaiveDateTime::MAX,
            )
            .await;
        assert!(not_found_result.is_err());
        assert_eq!(not_found_result.err(), Some(StatusCode::NOT_FOUND));

        let result_v1 = d
            .get_events_for_vehicle(VehicleIdT::new(1), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await;
        assert!(result_v1.is_ok());
        assert_eq!(result_v1.unwrap().len(), 4);

        let result_v2 = d
            .get_events_for_vehicle(VehicleIdT::new(2), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await;
        assert!(result_v2.is_ok());
        assert_eq!(result_v2.unwrap().len(), 2);

        // events are not in requested interval
        let emtpy_result_v1 = d
            .get_events_for_vehicle(
                VehicleIdT::new(1),
                NaiveDateTime::MIN,
                Utc::now().naive_utc(),
            )
            .await;
        assert!(emtpy_result_v1.is_ok());
        assert!(emtpy_result_v1.unwrap().is_empty());

        for i in 3..d.max_vehicle_id() {
            let result = d
                .get_events_for_vehicle(VehicleIdT::new(i), NaiveDateTime::MIN, NaiveDateTime::MAX)
                .await;
            assert!(result.is_ok());
            assert!(result.unwrap().is_empty());
        }
    }

    #[tokio::test]
    #[serial]
    async fn get_events_for_user_test() {
        test_main().await;
        let d = init(true, InitType::BackendTestWithEvents).await;

        let not_found_result = d
            .get_events_for_user(
                UserIdT::new(1 + d.users.len() as i32),
                NaiveDateTime::MIN,
                NaiveDateTime::MAX,
            )
            .await;
        assert!(not_found_result.is_err());
        assert_eq!(not_found_result.err(), Some(StatusCode::NOT_FOUND));

        // user         # of events created in init
        //   1                  4
        //   2                  2
        //   3                  0
        //   4                  0
        let result_v1 = d
            .get_events_for_user(UserIdT::new(1), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await;
        assert!(result_v1.is_ok());
        assert_eq!(result_v1.unwrap().len(), 4);

        let result_v2 = d
            .get_events_for_user(UserIdT::new(2), NaiveDateTime::MIN, NaiveDateTime::MAX)
            .await;
        assert!(result_v2.is_ok());
        assert_eq!(result_v2.unwrap().len(), 2);

        // events are not in requested interval
        let emtpy_result_v1 = d
            .get_events_for_user(UserIdT::new(1), NaiveDateTime::MIN, Utc::now().naive_utc())
            .await;
        assert!(emtpy_result_v1.is_ok());
        assert!(emtpy_result_v1.unwrap().is_empty());

        for i in 3..d.users.len() {
            let result = d
                .get_events_for_user(
                    UserIdT::new(i as i32),
                    NaiveDateTime::MIN,
                    NaiveDateTime::MAX,
                )
                .await;
            assert!(result.is_ok());
            assert!(result.unwrap().is_empty());
        }
    }

    #[tokio::test]
    #[serial]
    async fn get_events_for_tour_test() {
        test_main().await;
        let d = init(true, InitType::BackendTestWithEvents).await;

        // Init creates 3 tours with ids 1,2,3. Each has 2 events.
        let t1_result = d.get_events_for_tour(TourIdT::new(1)).await;
        assert!(t1_result.is_ok());
        assert!(t1_result.clone().unwrap().len() == 2);
        let first_event = *(t1_result.unwrap()[0]);
        assert_eq!(first_event.get_customer_id().await, UserIdT::new(1));

        let t2_result = d.get_events_for_tour(TourIdT::new(2)).await;
        assert!(t2_result.is_ok());
        assert!(t2_result.clone().unwrap().len() == 2);
        let first_event = *(t2_result.unwrap()[0]);
        assert_eq!(first_event.get_customer_id().await, UserIdT::new(1));

        let t3_result = d.get_events_for_tour(TourIdT::new(3)).await;
        assert!(t3_result.is_ok());
        assert!(t3_result.clone().unwrap().len() == 2);
        let first_event = *(t3_result.unwrap()[0]);
        assert_eq!(first_event.get_customer_id().await, UserIdT::new(2));

        let t4_result = d.get_events_for_tour(TourIdT::new(4)).await;
        assert!(t4_result.is_err());
        assert_eq!(t4_result.err(), Some(StatusCode::NOT_FOUND));
    }

    #[tokio::test]
    #[serial]
    async fn availability_statuscode_test() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let base_time = NaiveDate::from_ymd_opt(5000, 4, 15)
            .unwrap()
            .and_hms_opt(9, 10, 0)
            .unwrap();

        //Validate StatusCode cases
        //insert availability with non-existing vehicle
        let n_availabilities = d.get_n_availabilities();
        let n_vehicles = d.vehicles.len();
        assert_eq!(
            d.create_availability(
                base_time,
                base_time + Duration::hours(1),
                VehicleIdT::new(1 + n_vehicles as i32)
            )
            .await,
            StatusCode::NOT_FOUND
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities);
        //insert availability with existing vehicle
        let n_availabilities = d.get_n_availabilities();
        assert_eq!(
            d.create_availability(
                base_time,
                base_time + Duration::hours(1),
                VehicleIdT::new(n_vehicles as i32)
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities + 1);
        let n_availabilities = d.get_n_availabilities();

        //Validate nothing happened case handling when removing availabilies (expect StatusCode::NO_CONTENT)
        //endtime after year 100000
        assert_eq!(
            d.remove_availability(
                NaiveDate::from_ymd_opt(2025, 4, 15)
                    .unwrap()
                    .and_hms_opt(11, 10, 0)
                    .unwrap(),
                NaiveDate::from_ymd_opt(2026, 4, 15)
                    .unwrap()
                    .and_hms_opt(10, 0, 0)
                    .unwrap(),
                VehicleIdT::new(1)
            )
            .await,
            StatusCode::NO_CONTENT
        );
        assert_eq!(d.get_n_availabilities(), n_availabilities);
    }
    /*
    #[tokio::test]
    #[serial]
    async fn tour_test() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;
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
            "karolinenplatz 5",
            "Lichtwiesenweg 3",
            13.867512,
            51.22069,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            3,
            0,
            0,
            14.025081,
            51.195075,
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
            "karolinenplatz 5",
            "Lichtwiesenweg 3",
            13.867512,
            51.22069,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            3,
            0,
            0,
            14.025081,
            51.195075,
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
            "karolinenplatz 5",
            "Lichtwiesenweg 3",
            13.867512,
            51.22069,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            3,
            0,
            0,
            14.025081,
            51.195075,
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
            "karolinenplatz 5",
            "Lichtwiesenweg 3",
            13.867512,
            51.22069,
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 15, 0)
                .unwrap(),
            NaiveDate::from_ymd_opt(2024, 4, 15)
                .unwrap()
                .and_hms_opt(9, 12, 0)
                .unwrap(),
            2,
            3,
            0,
            0,
            14.025081,
            51.195075,
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

        check_data_db_synchronized(&d).await;
    } */

    #[tokio::test]
    #[serial]
    async fn test_handle_request_statuscodes() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let base_time = NaiveDate::from_ymd_opt(5000, 1, 1)
            .unwrap()
            .and_hms_opt(10, 0, 0)
            .unwrap();

        let test_points = TestPoints::new();

        // non-existing user
        assert_eq!(
            d.handle_routing_request(
                base_time,
                true,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                UserIdT::new(1 + d.users.len() as i32),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NOT_FOUND
        );

        // no passengers
        assert_eq!(
            d.handle_routing_request(
                base_time,
                true,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                UserIdT::new(1),
                0,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );

        // negative passenger count
        assert_eq!(
            d.handle_routing_request(
                base_time,
                true,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                UserIdT::new(1),
                -1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::EXPECTATION_FAILED
        );

        // too many passengers TODO change when mvp restriction is lifted
        assert_eq!(
            d.handle_routing_request(
                base_time,
                true,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                UserIdT::new(1),
                4,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NO_CONTENT
        );

        // request with start in the past
        assert_eq!(
            d.handle_routing_request(
                Utc::now().naive_utc() - Duration::minutes(1),
                true,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NOT_ACCEPTABLE
        );

        // request denied (no available vehicle)
        assert_eq!(
            d.handle_routing_request(
                base_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NO_CONTENT
        );

        // request with start in the future, but before MIN_PREP_TIME
        assert_eq!(
            d.handle_routing_request(
                Utc::now().naive_utc() + Duration::minutes(5),
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NO_CONTENT
        );

        //accepted_request
        assert_eq!(
            d.handle_routing_request(
                NaiveDate::from_ymd_opt(5000, 4, 19)
                    .unwrap()
                    .and_hms_opt(11, 0, 0)
                    .unwrap(),
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
    }

    #[tokio::test]
    #[serial]
    async fn test_beeline_duration() {
        //Test may fail, if constant/primitives/BEELINE_KMH is changed.
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        let mut test_points = TestPoints::new();
        let mut all_test_points = Vec::<Point>::new();
        all_test_points.append(&mut test_points.bautzen_ost);
        all_test_points.append(&mut test_points.bautzen_west);
        all_test_points.append(&mut test_points.gorlitz);
        //Check that all points in bautzen/görlitz areas are at most 1 hour apart according to the beeline distance function.
        for (p1, p2) in all_test_points
            .iter()
            .cartesian_product(all_test_points.iter())
        {
            assert!(beeline_duration(p1, p2) < Duration::hours(1));
        }
        //Check that beeline distances (as durations) to different points further away from the general bautzen/görtlitz area are reasonable.
        for p in all_test_points.iter() {
            // point in lisbon
            assert!(beeline_duration(p, &test_points.outside[0]) > Duration::days(1));
            assert!(beeline_duration(p, &test_points.outside[0]) < Duration::days(3));
            // point in USA
            assert!(beeline_duration(p, &test_points.outside[1]) > Duration::days(3));
            assert!(beeline_duration(p, &test_points.outside[1]) < Duration::days(7));
            // point in Frankfurt
            assert!(beeline_duration(p, &test_points.outside[2]) > Duration::hours(3));
            assert!(beeline_duration(p, &test_points.outside[2]) < Duration::hours(10));
            // point in Görlitz (negative area of multipolygon)
            assert!(beeline_duration(p, &test_points.outside[3]) < Duration::hours(1));
        }
        for (p, company) in all_test_points.iter().cartesian_product(d.companies.iter()) {
            println!(
                "{}  {}  -  company: {}   {}",
                p.0.x,
                p.0.y,
                company.central_coordinates.x(),
                company.central_coordinates.y()
            );
            assert!(beeline_duration(p, &company.central_coordinates) < Duration::hours(1));
        }
    }

    #[tokio::test]
    #[serial]
    async fn test_candidate_vehicles() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        let test_points = TestPoints::new();
        let candidate_ids_bautzen_west = d
            .get_candidate_vehicles(1, &test_points.bautzen_west[0])
            .await
            .iter()
            .map(|vehicle| vehicle.id)
            .collect_vec();
        let candidate_ids_bautzen_ost = d
            .get_candidate_vehicles(1, &test_points.bautzen_ost[0])
            .await
            .iter()
            .map(|vehicle| vehicle.id)
            .collect_vec();
        let candidate_ids_too_many_passengers = d
            .get_candidate_vehicles(4, &test_points.bautzen_ost[0])
            .await
            .iter()
            .map(|vehicle| vehicle.id)
            .collect_vec();
        for v_id in d.vehicles.iter().map(|vehicle| vehicle.id) {
            assert_eq!(candidate_ids_bautzen_ost.contains(&v_id), v_id.id() != 5);
        }

        for v_id in d.vehicles.iter().map(|vehicle| vehicle.id) {
            assert_eq!(candidate_ids_bautzen_west.contains(&v_id), v_id.id() == 5);
        }

        for v_id in d.vehicles.iter().map(|vehicle| vehicle.id) {
            assert!(!candidate_ids_too_many_passengers.contains(&v_id));
        }
    }

    #[traced_test]
    #[tokio::test]
    #[serial]
    async fn test_handle_request_concrete() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let start_time = NaiveDate::from_ymd_opt(5000, 4, 19)
            .unwrap()
            .and_hms_opt(11, 0, 0)
            .unwrap();
        let test_points = TestPoints::new();

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 1);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            2
        );
        //reversed start and target coordinates in time for concatenation
        assert_eq!(
            d.handle_routing_request(
                start_time + Duration::minutes(20),
                true,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 1);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            4
        );

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );

        //repeat first request - no tour-concatenation and out of availability for other vehicles -> request denied
        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::NO_CONTENT
        );
        assert_eq!(d.tour_count(), 3);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            8
        );

        assert_eq!(
            d.handle_routing_request(
                start_time + Duration::minutes(10),
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 3);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            10
        );
        check_data_db_synchronized(&d).await;
    }

    #[traced_test]
    #[tokio::test]
    #[serial]
    async fn test_handle_request_append() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let start_time = NaiveDate::from_ymd_opt(5000, 4, 19)
            .unwrap()
            .and_hms_opt(11, 0, 0)
            .unwrap();
        let test_points = TestPoints::new();

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 1);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            2
        );
        //reversed start and target coordinates in time for concatenation
        assert_eq!(
            d.handle_routing_request(
                start_time + Duration::minutes(20),
                true,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 1);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            4
        );
    }

    #[traced_test]
    #[tokio::test]
    #[serial]
    async fn test_handle_request_prepend() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let start_time = NaiveDate::from_ymd_opt(5000, 4, 19)
            .unwrap()
            .and_hms_opt(12, 30, 0)
            .unwrap();
        let test_points = TestPoints::new();

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );
        assert_eq!(d.tour_count(), 1);
        assert_eq!(
            d.vehicles
                .iter()
                .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
                .count(),
            2
        );
        //reversed start and target coordinates with fixed target time instead of fixed start time, in time for prepend
        assert_eq!(
            d.handle_routing_request(
                start_time - Duration::minutes(15),
                false,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                UserIdT::new(1),
                2,
                "target_address",
                "start_address",
            )
            .await,
            StatusCode::CREATED
        );
        // since there are only 2 requests and those were concatenated, there must be 1 vehicle doing 1 tour with 4 events all other vehicles must not have any tours.
        let mut vehicle_with_tours_found = false;
        for v in d.vehicles.iter() {
            if vehicle_with_tours_found {
                assert!(v.tours.is_empty());
            }
            if !v.tours.is_empty() {
                assert_eq!(v.tours.len(), 1);
                assert_eq!(v.tours.iter().flat_map(|t| &t.events).count(), 4);
                vehicle_with_tours_found = true;
            }
        }
        // since the second request was prepended to the first one, the earliest event must be part of the 2nd request.
        assert_eq!(
            d.vehicles
                .iter()
                .filter(|v| !v.tours.is_empty())
                .flat_map(|v| &v.tours)
                .flat_map(|t| &t.events)
                .min_by_key(|ev| ev.scheduled_time)
                .unwrap()
                .request_id,
            2,
        );
    }

    #[tokio::test]
    #[serial]
    async fn test_change_vehicle_concrete() {
        test_main().await;
        let mut d = init(true, InitType::BackendTestWithEvents).await;

        // verify that tour with id 1 is done by vehicle with id 1
        let tour = d.get_tour(TourIdT::new(1)).await;
        assert!(tour.is_ok());
        let tour = tour.unwrap();
        assert_eq!(tour.vehicle, VehicleIdT::new(1));

        // old and new vehicle are the same
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(1), VehicleIdT::new(1))
                .await,
            StatusCode::NO_CONTENT
        );

        // vehicle is not available
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(1), VehicleIdT::new(5))
                .await,
            StatusCode::NOT_ACCEPTABLE
        );

        // change possible
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(1), VehicleIdT::new(2))
                .await,
            StatusCode::OK
        )
    }

    #[traced_test]
    #[tokio::test]
    #[serial]
    async fn test_change_vehicle_statuscodes() {
        test_main().await;
        let mut d = init(true, InitType::BackendTest).await;

        let start_time = NaiveDate::from_ymd_opt(5000, 4, 19)
            .unwrap()
            .and_hms_opt(12, 30, 0)
            .unwrap();
        let test_points = TestPoints::new();

        assert_eq!(
            d.handle_routing_request(
                start_time,
                true,
                test_points.bautzen_ost[0].y() as f32,
                test_points.bautzen_ost[0].x() as f32,
                test_points.bautzen_ost[1].y() as f32,
                test_points.bautzen_ost[1].x() as f32,
                UserIdT::new(1),
                1,
                "start_address",
                "target_address",
            )
            .await,
            StatusCode::CREATED
        );

        //non-existing vehicle
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(1), VehicleIdT::new(6))
                .await,
            StatusCode::NOT_FOUND
        );

        //non-existing tour
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(2), VehicleIdT::new(1))
                .await,
            StatusCode::NOT_FOUND
        );

        //vehicle is not available during tour
        assert_eq!(
            d.change_vehicle_for_tour(TourIdT::new(1), VehicleIdT::new(5))
                .await,
            StatusCode::NOT_ACCEPTABLE
        );
    }

    #[tokio::test]
    #[serial]
    async fn get_vehicles_test() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        let c1_license_plates = ["TUB1-1", "TUB1-2"];
        let c2_license_plates = ["TUB2-1", "TUB2-2"];
        let c3_license_plates = ["TUG1-1"];

        let c1_res = d.get_vehicles(CompanyIdT::new(1)).await;
        assert!(c1_res.is_ok());
        let c1 = c1_res.unwrap();
        assert_eq!(c1.len(), 2);
        assert!(c1_license_plates.contains(&(*c1[0]).get_license_plate().await));
        assert!(c1_license_plates.contains(&(*c1[1]).get_license_plate().await));

        let c2_res = d.get_vehicles(CompanyIdT::new(2)).await;
        assert!(c2_res.is_ok());
        let c2 = c2_res.unwrap();
        assert_eq!(c2.len(), 2);
        assert!(c2_license_plates.contains(&(*c2[0]).get_license_plate().await));
        assert!(c2_license_plates.contains(&(*c2[1]).get_license_plate().await));

        let c3_res = d.get_vehicles(CompanyIdT::new(3)).await;
        assert!(c3_res.is_ok());
        let c3 = c3_res.unwrap();
        assert_eq!(c3.len(), 1);
        assert!(c3_license_plates.contains(&(*c3[0]).get_license_plate().await));

        let c4_res = d.get_vehicles(CompanyIdT::new(4)).await;
        assert!(c4_res.is_err());
        assert_eq!(c4_res.err(), Some(StatusCode::NOT_FOUND));
    }

    #[tokio::test]
    #[serial]
    async fn get_company_for_user_test() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        let c1 = d.get_company_for_user(&d.users[&UserIdT::new(1)]).await;
        assert!(c1.is_some());
        let c1 = c1.unwrap();
        assert!(c1.is_ok());
        let c1 = *c1.unwrap();
        assert_eq!(c1.get_name().await, "Taxi-Unternehmen Bautzen-1");

        let c2 = d.get_company_for_user(&d.users[&UserIdT::new(2)]).await;
        assert!(c2.is_none());
    }

    #[tokio::test]
    #[serial]
    async fn get_company_for_vehicle_test() {
        test_main().await;
        let d = init(true, InitType::BackendTest).await;

        let c1 = d.get_company_for_vehicle(&d.vehicles[0]).await;
        assert!(c1.is_ok());
        let c1 = *c1.unwrap();
        assert_eq!(c1.get_name().await, "Taxi-Unternehmen Bautzen-1");

        let c2 = d.get_company_for_vehicle(&d.vehicles[1]).await;
        assert!(c2.is_ok());
        let c2 = *c2.unwrap();
        assert_eq!(c2.get_name().await, "Taxi-Unternehmen Bautzen-1");

        let c3 = d.get_company_for_vehicle(&d.vehicles[2]).await;
        assert!(c3.is_ok());
        let c3 = *c3.unwrap();
        assert_eq!(c3.get_name().await, "Taxi-Unternehmen Bautzen-2");

        let c4 = d.get_company_for_vehicle(&d.vehicles[3]).await;
        assert!(c4.is_ok());
        let c4 = *c4.unwrap();
        assert_eq!(c4.get_name().await, "Taxi-Unternehmen Bautzen-2");

        let c5 = d.get_company_for_vehicle(&d.vehicles[4]).await;
        assert!(c5.is_ok());
        let c5 = *c5.unwrap();
        assert_eq!(c5.get_name().await, "Taxi-Unternehmen Görlitz-1");
    }

    #[tokio::test]
    #[serial]
    async fn get_customer_for_event_test() {
        test_main().await;
        let d = init(true, InitType::BackendTestWithEvents).await;

        let events = d
            .vehicles
            .iter()
            .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
            .sorted_by_key(|event| &event.id)
            .collect_vec();

        let u1 = d.get_customer_for_event(events[0]).await;
        assert!(u1.is_ok());
        let u1 = *u1.unwrap();
        assert_eq!(u1.get_name().await, "TestDriver1");
        assert_eq!(*u1.get_id().await, UserIdT::new(1));

        let u2 = d.get_customer_for_event(events[1]).await;
        assert!(u2.is_ok());
        let u2 = *u2.unwrap();
        assert_eq!(u2.get_name().await, "TestDriver1");
        assert_eq!(*u2.get_id().await, UserIdT::new(1));

        let u3 = d.get_customer_for_event(events[2]).await;
        assert!(u3.is_ok());
        let u3 = *u3.unwrap();
        assert_eq!(u3.get_name().await, "TestDriver1");
        assert_eq!(*u3.get_id().await, UserIdT::new(1));

        let u4 = d.get_customer_for_event(events[3]).await;
        assert!(u4.is_ok());
        let u4 = *u4.unwrap();
        assert_eq!(u4.get_name().await, "TestDriver1");
        assert_eq!(*u4.get_id().await, UserIdT::new(1));

        let u5 = d.get_customer_for_event(events[4]).await;
        assert!(u5.is_ok());
        let u5 = *u5.unwrap();
        assert_eq!(u5.get_name().await, "TestUser1");
        assert_eq!(*u5.get_id().await, UserIdT::new(2));

        let u6 = d.get_customer_for_event(events[5]).await;
        assert!(u6.is_ok());
        let u6 = *u6.unwrap();
        assert_eq!(u6.get_name().await, "TestUser1");
        assert_eq!(*u6.get_id().await, UserIdT::new(2));
    }

    #[tokio::test]
    #[serial]
    async fn get_address_for_event_test() {
        test_main().await;
        let d = init(true, InitType::BackendTestWithEvents).await;

        let events = d
            .vehicles
            .iter()
            .flat_map(|v| v.tours.iter().flat_map(|t| &t.events))
            .sorted_by_key(|event| &event.id)
            .collect_vec();

        assert_eq!(d.get_address_for_event(events[0]).await, "start_address");
        assert_eq!(d.get_address_for_event(events[1]).await, "target_address");
        assert_eq!(d.get_address_for_event(events[2]).await, "start_address");
        assert_eq!(d.get_address_for_event(events[3]).await, "target_address");
        assert_eq!(d.get_address_for_event(events[4]).await, "start_address");
        assert_eq!(d.get_address_for_event(events[5]).await, "target_address");
    }
}
