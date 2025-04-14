import type { Session } from '$lib/server/auth/session';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session;
		}
		// interface PageData {}
		interface PageState {
			selectFrom?: boolean;
			selectTo?: boolean;
			selectedItinerary?: Itinerary | null;
			stop?: { name: string; stopId: string; time: Date };
			showMap?: boolean;
		}
		// interface Platform {}
	}
}

export {};
