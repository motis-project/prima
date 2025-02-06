export type Coordinates = {
	lat: number;
	lng: number;
	address?: string;
};

export const toCoordinates = (c: Coordinates): Coordinates => {
	return { lat: c.lat, lng: c.lng };
};
