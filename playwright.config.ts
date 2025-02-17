import { defineConfig } from '@playwright/test';

export default defineConfig({
	// test for development version
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		timeout: 20000,
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://localhost:5173',
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin'
	},

	// webServer: {
	// 	command: 'docker compose up prima',
	// 	url: 'http://localhost:7777',
	// 	timeout: 20000,
	// 	reuseExistingServer: true
	// },
	// use: {
	// 	baseURL: 'http://localhost:7777',
	// 	locale: 'de-DE',
	// 	timezoneId: 'Europe/Berlin'
	// },

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
		},
		{
			name: 'driver app',
			testMatch: 'driver.test.ts',
			dependencies: ['availability']
		}
	]
});
