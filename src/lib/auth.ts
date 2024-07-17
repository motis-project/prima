import { Lucia } from 'lucia';
import { dev } from '$app/environment';
import { NodePostgresAdapter } from '@lucia-auth/adapter-postgresql';
import { pool } from './database';

declare module 'lucia' {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	email: string;
	is_entrepreneur: boolean;
	is_maintainer: boolean;
}

const adapter = new NodePostgresAdapter(pool, {
	user: 'auth_user',
	session: 'user_session'
});

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev
		}
	},
	getUserAttributes: (attributes) => {
		return {
			email: attributes.email,
			is_entrepreneur: attributes.is_entrepreneur,
			is_maintainer: attributes.is_maintainer
		};
	}
});
