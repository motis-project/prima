import { defineConfig } from '@playwright/test';

export default defineConfig({
	// test for development version
	timeout: 70_000,
	fullyParallel: false,
	workers: 1,
	globalSetup: './e2e/db.setup.ts',
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		timeout: 60000,
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://localhost:5173',
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
		launchOptions: {
			slowMo: 500
		}
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
			name: 'login',
			testMatch: 'login.setup.test.ts'
		},
		{
			name: 'companyData',
			testMatch: 'companyData.test.ts'
		},
		{
			name: 'taxiOwnerAssignsRoles',
			testMatch: 'taxiOwnerAssignsRoles.test.ts'
		},
		{
			name: 'availability',
			testMatch: 'availability.test.ts'
		},
		{
			name: 'move tour',
			testMatch: 'moveTour.test.ts'
		},
		{
			name: 'ride share',
			testMatch: 'rideShare.test.ts'
		},
		{
			name: 'driver app',
			testMatch: 'driver.test.ts'
		}
	]
});
