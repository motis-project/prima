import type { Session } from '$lib/server/auth/session';
import type { SignedItinerary } from '$lib/planAndSign';

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
			selectedItinerary?: SignedItinerary | undefined;
			stop?: { name: string; stopId: string; time: Date };
			showMap?: boolean;
		}
		// interface Platform {}
	}
}

export {};
