import { type Generated, CamelCasePlugin, PostgresDialect, Kysely } from 'kysely';
import { env } from '$env/dynamic/private';
import pg from 'pg';

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
		phone: string | null;
		companyId: number | null;
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
		lat: number;
		lng: number;
		scheduledTimeStart: number;
		scheduledTimeEnd: number;
		communicatedTime: number;
		prevLegDuration: number;
		nextLegDuration: number;
		eventGroup: string;
		address: string;
		request: number;
		cancelled: boolean;
	};
	request: {
		id: Generated<number>;
		passengers: number;
		wheelchairs: number;
		bikes: number;
		luggage: number;
		tour: number;
		customer: number;
		ticketCode: string;
		ticketChecked: boolean;
		cancelled: boolean;
	};
	journey: {
		id: Generated<number>;
		json: string;
		user: number;
		request1: number;
		request2: number | null;
		rating: number | null;
		comment: string | null;
	};
	favouriteLocations: {
		id: Generated<number>;
		user: number;
		address: string;
		lat: number;
		lng: number;
		level: number;
		lastTimestamp: number;
		count: number;
	};
	favouriteRoutes: {
		id: Generated<number>;
		user: number;
		fromId: number;
		toId: number;
		lastTimestamp: number;
		count: number;
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
			// `'query'`
			console.log('Query executed : ', {
				durationMs: event.queryDurationMillis,
				sql: event.query.sql,
				params: event.query.parameters
			});
		}
	}
});
