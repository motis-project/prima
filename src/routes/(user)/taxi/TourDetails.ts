export type TourDetails = {
	tour_id: number;
	from: Date;
	to: Date;
	vehicle_id: number;
	license_plate: string;
	company_id: number | null;
	events: Array<Event>;
};

export type Event = {
	address: number;
	latitude: number;
	longitude: number;
	street: string;
	postal_code: string;
	city: string;
	scheduled_time: Date;
	house_number: string;
	first_name: string | null;
	last_name: string | null;
	phone: string | null;
	is_pickup: boolean;
	customer_id: string | null;
};
