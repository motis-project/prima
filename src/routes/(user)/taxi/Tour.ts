import { Range } from './Range';

export class Tour extends Range {
	id!: number;
	vehicle_id!: number;
	departure!: Date;
	arrival!: Date;
	license_plate!: string;
}
