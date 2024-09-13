import { defineConfig } from '@playwright/test';
export default defineConfig({
	// test for development version
	webServer: {
		command: 'while true; do npm run dev; done',
		url: 'http://localhost:5173',
		timeout: 20000,
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://localhost:5173/'
	},
	// webServer: {
	// 	command: 'docker compose up prima',
	// 	url: 'http://127.0.0.1:8080',
	// 	timeout: 10000,
	// 	reuseExistingServer: true
	// },
	// use: {
	// 	baseURL: 'http://localhost:8080/'
	// },
	testDir: './tests',
	projects: [
		{
			name: 'setup db',
			testMatch: /db\.setup\.ts/
		},
		{
			name: 'login',
			testMatch: /login\.setup\.ts/,
			dependencies: ['setup db']
		},
		{
			name: 'entrepreneurAssignsRoles',
			testMatch: /entrepreneurAssignsRoles\.ts/,
			dependencies: ['login']
		},
		{
			name: 'availability',
			testMatch: /availability\.ts/,
			dependencies: ['login']
		},
		{
			name: 'move tour',
			testMatch: /moveTour\.ts/,
			dependencies: ['availability']
		}
	]
});
