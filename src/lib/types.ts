import { type Generated, type Insertable, type Selectable, type Updateable } from 'kysely';

export interface Database {
	zone: ZoneTable;
	company: CompanyTable;
	vehicle: VehicleTable;
	tour: TourTable;
	availability: AvailabilityTable;
	auth_user: UserAuthTable;
	user_session: UserSessionTable;
	event: EventTable;
	address: AdressTable;
}

// ====
// ZONE
// ----
export interface ZoneTable {
	id: Generated<number>;
	area: string;
	name: string;
	is_community: boolean;
}

export type Zone = Selectable<ZoneTable>;
export type NewZone = Insertable<ZoneTable>;
export type ZoneUpdate = Updateable<ZoneTable>;

// =======
// COMPANY
// -------
export interface CompanyTable {
	id: Generated<number>;
	latitude: number;
	longitude: number;
	name: string;
	address: string;
	zone: number;
	community_area: number;
}

export type Company = Selectable<CompanyTable>;
export type NewCompany = Insertable<CompanyTable>;
export type CompanyUpdate = Updateable<CompanyTable>;

// =======
// VEHICLE
// -------
export interface VehicleTable {
	id: Generated<number>;
	license_plate: string;
	company: number;
	seats: number;
	wheelchair_capacity: number;
	bike_capacity: number;
	storage_space: number;
}

export type Vehicle = Selectable<VehicleTable>;
export type NewVehicle = Insertable<VehicleTable>;
export type VehicleUpdate = Updateable<VehicleTable>;

// ====
// TOUR
// ----
export interface TourTable {
	id: Generated<number>;
	departure: Date;
	arrival: Date;
	vehicle: number;
}

export type Tour = Selectable<TourTable>;
export type NewTour = Insertable<TourTable>;
export type TourUpdate = Updateable<TourTable>;

// ============
// AVAILABILITY
// ------------
export interface AvailabilityTable {
	id: Generated<number>;
	start_time: Date;
	end_time: Date;
	vehicle: number;
}

export type Availability = Selectable<AvailabilityTable>;
export type NewAvailability = Insertable<AvailabilityTable>;
export type AvailabilityUpdate = Updateable<AvailabilityTable>;

// =========
// USER_AUTH
// ---------
export interface UserAuthTable {
	id: string;
	email: string;
	password_hash: string;
}

export type UserAuth = Selectable<UserAuthTable>;
export type NewUserAuth = Insertable<UserAuthTable>;
export type UserAuthUpdate = Updateable<UserAuthTable>;

// ============
// USER_SESSION
// ------------
export interface UserSessionTable {
	id: string;
	expires_at: Date;
	user_id: string;
}

export type UserSession = Selectable<UserSessionTable>;
export type NewUserSession = Insertable<UserSessionTable>;
export type UserSessionUpdate = Updateable<UserAuthTable>;

// ============
// EVENTS
// ------------
export interface EventTable {
	id: Generated<number>;
	is_pickup: boolean;
    latitude: number;
    longitude: number;
    scheduled_time: Date;
    communicated_time: Date;
    address: number;
	tour: number;
}

export type Event = Selectable<EventTable>;

// ============
// ADDRESS
// ------------
export interface AdressTable {
	id: Generated<number>;
	address_str: string;
}

export type Adress = Selectable<AdressTable>;
