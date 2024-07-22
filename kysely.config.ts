import { defineConfig } from 'kysely-ctl';
import { dialect } from './src/lib/database';

export default defineConfig({
	dialect,
	migrations: {
		allowJS: true
	}
});
