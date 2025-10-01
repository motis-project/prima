import { type Generated, CamelCasePlugin, PostgresDialect, Kysely } from 'kysely';
import { env } from '$env/dynamic/private';
import pg from 'pg';
import type { SignedItinerary } from '$lib/planAndSign';

export interface Database {
	user: {
		id: Generated<number>;
		email: string;
		name: string;
		passwordHash: string;
		isEmailVerified: boolean;
		emailVerificationCode: string | null;
		emailVerificationExpiresAt: number | null;
		passwordResetCode: string | null;
		passwordResetExpiresAt: number | null;
		isTaxiOwner: boolean;
		isAdmin: boolean;
		isService: boolean;
		phone: string | null;
		companyId: number | null;
		firstName: string;
		gender: string;
		zipCode: string;
		city: string;
		region: string;
	};
	session: {
		id: string;
		expiresAt: number;
		userId: number;
	};
	zone: {
		id: Generated<number>;
		name: string;
		isCommunity: boolean;
		rates: number;
	};
	company: {
		id: Generated<number>;
		lat: number | null;
		lng: number | null;
		name: string | null;
		address: string | null;
		zone: number | null;
		phone: string | null;
	};
	vehicle: {
		id: Generated<number>;
		licensePlate: string;
		company: number;
		passengers: number;
		wheelchairs: number;
		bikes: number;
		luggage: number;
	};
	tour: {
		id: Generated<number>;
		departure: number;
		arrival: number;
		vehicle: number;
		fare: number | null;
		directDuration: number | null;
		cancelled: boolean;
		message: string | null;
	};
	availability: {
		id: Generated<number>;
		startTime: number;
		endTime: number;
		vehicle: number;
	};
	event: {
		id: Generated<number>;
		isPickup: boolean;
		eventGroupId: number;
		request: number;
		cancelled: boolean;
		communicatedTime: number;
	};
	eventGroup: {
		id: Generated<number>;
		lat: number;
		lng: number;
		scheduledTimeStart: number;
		scheduledTimeEnd: number;
		prevLegDuration: number;
		nextLegDuration: number;
		address: string;
	};
	request: {
		id: Generated<number>;
		passengers: number;
		kidsZeroToTwo: number;
		kidsThreeToFour: number;
		kidsFiveToSix: number;
		wheelchairs: number;
		bikes: number;
		luggage: number;
		tour: number | null;
		rideShareTour: number | null;
		customer: number;
		ticketCode: string;
		ticketChecked: boolean;
		ticketPrice: number;
		cancelled: boolean;
		licensePlateUpdatedAt: number | null;
		pending: boolean;
		startFixed: boolean | null;
		busStopTime: number | null;
		requestedTime: number | null;
	};
	journey: {
		id: Generated<number>;
		json: SignedItinerary;
		user: number;
		request1: number | null;
		request2: number | null;
		reason: string | null;
		rating: number | null;
		ratingBooking: number | null;
		comment: string | null;
	};
	fcmToken: {
		deviceId: string;
		company: number;
		fcmToken: string;
	};
	rideShareTour: {
		id: Generated<number>;
		passengers: number;
		luggage: number;
		cancelled: boolean;
		vehicle: number;
		communicatedStart: number;
		communicatedEnd: number;
		earliestStart: number;
		latestEnd: number;
	};
	rideShareVehicle: {
		id: Generated<number>;
		passengers: number;
		luggage: number;
		owner: number;
		color: string | null;
		model: string | null;
		smokingAllowed: boolean;
		licensePlate: string;
	};
}

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
export const dialect = new PostgresDialect({ pool });

// Map int8 to number.
pg.types.setTypeParser(20, (val) => parseInt(val));

export const db = new Kysely<Database>({
	dialect,
	plugins: [new CamelCasePlugin()],
	log(event) {
		if (event.level === 'error') {
			console.error('Query failed : ', {
				durationMs: event.queryDurationMillis,
				error: event.error,
				sql: event.query.sql,
				params: event.query.parameters
			});
		} else {
			console.log('Query executed : ', {
				durationMs: event.queryDurationMillis,
				sql: event.query.sql,
				params: event.query.parameters
			});
		}
	}
});
