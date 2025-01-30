import { type Generated, CamelCasePlugin, PostgresDialect, Kysely, type LogEvent } from 'kysely';
import { DATABASE_URL } from '$env/static/private';
import pg from 'pg';

export interface Database {
	user: {
		id: Generated<number>;
		email: string;
		name: string;
		passwordHash: string;
		isEmailVerified: boolean;
		emailVerificationCode: string | null;
		emailVerificationExpiresAt: Date | null;
		passwordResetCode: string | null;
		passwordResetExpiresAt: Date | null;
		isTaxiOwner: boolean;
		isAdmin: boolean;
		phone: string | null;
		companyId: number | null;
	};
	session: {
		id: string;
		expiresAt: Date;
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
		seats: number;
		wheelchairCapacity: number;
		bikeCapacity: number;
		storageSpace: number;
	};
	tour: {
		id: Generated<number>;
		departure: Date;
		arrival: Date;
		vehicle: number;
		fare: number | null;
	};
	availability: {
		id: Generated<number>;
		startTime: Date;
		endTime: Date;
		vehicle: number;
	};
	event: {
		id: Generated<number>;
		isPickup: boolean;
		lat: number;
		lng: number;
		scheduledTime: Date;
		communicatedTime: Date;
		address: string;
		tour: number;
		customer: number;
		request: number;
	};
	request: {
		id: Generated<number>;
		passengers: number;
		wheelchairs: number;
		bikes: number;
		luggage: number;
		tour: number;
	};
}

export const pool = new pg.Pool({ connectionString: DATABASE_URL });
export const dialect = new PostgresDialect({ pool });
export const db = new Kysely<Database>({
	dialect,
	plugins: [new CamelCasePlugin()],
	log(event: LogEvent) {
		if (event.level === 'error') {
			console.error('Query failed : ', {
				durationMs: event.queryDurationMillis,
				error: event.error,
				sql: event.query.sql,
				params: event.query.parameters
			});
		}
	}
});
