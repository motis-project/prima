export class Range {
	from!: Date;
	to!: Date;
}

export class Tour extends Range {
	tour_id!: number;
	vehicle_id!: number;
}

export class Vehicle {
	license_plate!: string;
	availability!: Array<Range>;
}
