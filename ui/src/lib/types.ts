import { type Generated, type Insertable, type Selectable, type Updateable } from 'kysely';

export interface Database {
	zone: ZoneTable;
	company: CompanyTable;
	vehicle: VehicleTable;
}

export interface ZoneTable {
	id: Generated<number>;
	area: string;
	name: string;
}

export type Zone = Selectable<ZoneTable>;
export type NewZone = Insertable<ZoneTable>;
export type ZoneUpdate = Updateable<ZoneTable>;

export interface CompanyTable {
	id: Generated<number>;
	latitude: number;
	longitude: number;
	display_name: string;
	email: string;
	zone: number;
}

export type Company = Selectable<CompanyTable>;
export type NewCompany = Insertable<CompanyTable>;
export type CompanyUpdate = Updateable<CompanyTable>;

export interface VehicleTable {
	id: Generated<number>;
	license_plate: string;
	company: number;
	seats: number;
	wheelchair_capacity: number;
	storage_space: number;
}

export type Vehicle = Selectable<VehicleTable>;
export type NewVehicle = Insertable<VehicleTable>;
export type VehicleUpdate = Updateable<VehicleTable>;
