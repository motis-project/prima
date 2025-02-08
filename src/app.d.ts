import type { Session } from '$lib/server/auth/session';
import type { Itinerary } from '$lib/openapi';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session;
		}
		// interface PageData {}
		interface PageState {
			selectedItinerary?: Itinerary;
			selectedStop?: { name: string; stopId: string; time: Date };
			stopArriveBy?: boolean;
			tripId?: string;
		}
		// interface Platform {}
	}
}

export {};
