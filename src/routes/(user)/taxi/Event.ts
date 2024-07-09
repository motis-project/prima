export class Event {
	id!: number;
	is_pickup!: boolean;
	latitude!: number;
	longitude!: number;
	scheduled_time!: Date;
	communicated_time!: Date;
	street!: string;
	house_number!: string;
	postal_code!: string;
	city!: string;
	tour!: number;
}
