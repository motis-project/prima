import type { Insertion } from './insertion';

export type TripId = Insertion & {
	requestedTime: number;
};

export function retrieveRequestedTime(tripId: string) {
	return (JSON.parse(tripId) as TripId).requestedTime;
}
