import type { NewAddress } from "./types";

export class Coordinates {
	constructor(lat: number, lng: number) {
		this.lat = lat;
		this.lng = lng;
	}

	lat: number;
	lng: number;
}

export class Loc {
	constructor(coordinates: Coordinates, address: NewAddress){
		this.coordinates = coordinates;
		this.address = address;
	}

	coordinates: Coordinates;
	address: NewAddress;
}
