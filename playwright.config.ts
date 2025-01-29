import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		reuseExistingServer: true,
		port: 5173
	},

	testDir: 'e2e',

	projects: [
		{
			name: 'setup db',
			testMatch: 'db.setup.ts'
		},
		{
			name: 'login',
			testMatch: 'login.setup.test.ts',
			dependencies: ['setup db']
		},
		{
			name: 'entrepreneurAssignsRoles',
			testMatch: 'entrepreneurAssignsRoles.test.ts',
			dependencies: ['login']
		},
		{
			name: 'availability',
			testMatch: 'availability.test.ts',
			dependencies: ['login']
		},
		{
			name: 'move tour',
			testMatch: 'moveTour.test.ts',
			dependencies: ['availability']
		}
	]
});
