use crate::backend::{
    id_types::{AddressIdT, CompanyIdT, EventIdT, TourIdT, UserIdT, VehicleIdT, ZoneIdT},
    interval::Interval,
};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use hyper::StatusCode;
use std::collections::HashMap;

/*
StatusCode and associated errors/results:
INTERNAL_SERVER_ERROR           something bad happened
BAD_REQUEST                     invalid geojson for multipolygon (area of zone), or provided ids do not match, or invalid user role
EXPECTATION_FAILED              foreign key violation
CONFLICT                        unique key violation
NO_CONTENT                      used in remove_interval and handle_request, request did not produce an error but did not change anything either (in case of request->denied)
NOT_ACCEPTABLE                  provided interval is not valid, or request is in the past, or trying to remove availability needed for a tour
NOT_FOUND                       data with provided id was not found
CREATED                         request processed succesfully, data has been created
OK                              request processed succesfully
*/

#[async_trait]
pub trait PrimaTour: Send + Sync {
    async fn get_events(&self) -> Vec<Box<&dyn PrimaEvent>>;
    async fn get_arrival(&self) -> NaiveDateTime;
    async fn get_departure(&self) -> NaiveDateTime;
    async fn get_id(&self) -> TourIdT;
}

#[async_trait]
pub trait PrimaEvent: Send + Sync {
    async fn get_id(&self) -> &EventIdT;
    async fn get_lat(&self) -> f32;
    async fn get_lng(&self) -> f32;
    async fn get_customer_id(&self) -> UserIdT;
    async fn get_address_id(&self) -> &AddressIdT;
}

#[async_trait]
pub trait PrimaVehicle: Send + Sync {
    async fn get_id(&self) -> &VehicleIdT;
    async fn get_license_plate(&self) -> &str;
    async fn get_company_id(&self) -> &CompanyIdT;
    async fn get_tours(&self) -> Vec<Box<&dyn PrimaTour>>;
}

#[async_trait]
pub trait PrimaUser: Send + Sync {
    async fn get_id(&self) -> &UserIdT;
    async fn get_name(&self) -> &str;
    async fn is_driver(&self) -> bool;
    async fn is_disponent(&self) -> bool;
    async fn is_admin(&self) -> bool;
    async fn get_company_id(&self) -> &Option<CompanyIdT>;
}

#[async_trait]
pub trait PrimaCompany {
    async fn get_id(&self) -> &CompanyIdT;
    async fn get_name(&self) -> &str;
}

#[async_trait]
pub trait PrimaData: Send + Sync {
    async fn read_data_from_db(&mut self);

    async fn create_vehicle(
        &mut self,
        license_plate: &str,
        company: CompanyIdT,
    ) -> StatusCode;

    #[allow(clippy::too_many_arguments)]
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
    ) -> StatusCode;

    async fn create_availability(
        &mut self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle: VehicleIdT,
    ) -> StatusCode;

    async fn create_zone(
        &mut self,
        name: &str,
        area_str: &str,
    ) -> StatusCode;

    async fn create_company(
        &mut self,
        name: &str,
        zone: ZoneIdT,
        email: &str,
        lat: f32,
        lng: f32,
    ) -> StatusCode;

    async fn remove_availability(
        &mut self,
        start_time: NaiveDateTime,
        end_time: NaiveDateTime,
        vehicle_id: VehicleIdT,
    ) -> StatusCode;

    async fn change_vehicle_for_tour(
        &mut self,
        tour_id: TourIdT,
        new_vehicle_id: VehicleIdT,
    ) -> StatusCode;

    async fn get_company(
        &self,
        company_id: &CompanyIdT,
    ) -> Result<Box<&dyn PrimaCompany>, StatusCode>;

    async fn get_user(
        &self,
        user_id: UserIdT,
    ) -> Result<Box<&dyn PrimaUser>, StatusCode>;

    async fn get_address(
        &self,
        address_id: &AddressIdT,
    ) -> &str;

    async fn get_tours(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&dyn PrimaTour>>, StatusCode>;

    async fn get_vehicles(
        &self,
        company_id: CompanyIdT,
    ) -> Result<Vec<Box<&dyn PrimaVehicle>>, StatusCode>;

    async fn get_events_for_vehicle(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&dyn PrimaEvent>>, StatusCode>;

    async fn get_events_for_user(
        &self,
        user_id: UserIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<Box<&dyn PrimaEvent>>, StatusCode>;

    async fn get_events_for_tour(
        &self,
        tour_id: TourIdT,
    ) -> Result<Vec<Box<&dyn PrimaEvent>>, StatusCode>;

    async fn get_idle_vehicles(
        &self,
        company_id: CompanyIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<Box<&dyn PrimaVehicle>>, StatusCode>;

    async fn is_vehicle_idle(
        &self,
        vehicle_id: VehicleIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<bool, StatusCode>;

    async fn get_company_conflicts(
        &self,
        company_id: CompanyIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<HashMap<VehicleIdT, Vec<Box<&dyn PrimaTour>>>, StatusCode>;

    async fn get_vehicle_conflicts(
        &self,
        vehicle_id: VehicleIdT,
        tour_id: TourIdT,
        consider_provided_tour_conflict: bool,
    ) -> Result<Vec<Box<&dyn PrimaTour>>, StatusCode>;

    async fn get_tour_conflicts(
        &self,
        event_id: EventIdT,
        company_id: Option<CompanyIdT>,
    ) -> Result<Vec<Box<&dyn PrimaTour>>, StatusCode>;

    async fn get_availability_intervals(
        &self,
        vehicle_id: VehicleIdT,
        time_frame_start: NaiveDateTime,
        time_frame_end: NaiveDateTime,
    ) -> Result<Vec<&Interval>, StatusCode>;

    async fn is_vehicle_available(
        &self,
        vehicle: VehicleIdT,
        tour_id: TourIdT,
    ) -> Result<bool, StatusCode>;

    #[allow(clippy::too_many_arguments)]
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
    ) -> StatusCode;

    async fn get_company_for_user(
        &self,
        user: &dyn PrimaUser,
    ) -> Option<Result<Box<&dyn PrimaCompany>, StatusCode>> {
        match user.get_company_id().await {
            None => None,
            Some(company_id) => Some(self.get_company(company_id).await),
        }
    }

    async fn get_company_for_vehicle(
        &self,
        vehicle: &dyn PrimaVehicle,
    ) -> Result<Box<&dyn PrimaCompany>, StatusCode> {
        self.get_company(vehicle.get_company_id().await).await
    }

    async fn get_customer_for_event(
        &self,
        event: &dyn PrimaEvent,
    ) -> Result<Box<&dyn PrimaUser>, StatusCode> {
        self.get_user(event.get_customer_id().await).await
    }

    async fn get_address_for_event(
        &self,
        event: &dyn PrimaEvent,
    ) -> &str {
        self.get_address(event.get_address_id().await).await
    }
}
