import { defineConfig } from '@playwright/test';
export default defineConfig({
	webServer: {
		command: 'docker compose up prima',
		url: 'http://127.0.0.1:8080',
		timeout: 10000,
		reuseExistingServer: true
	},
	use: {
		baseURL: 'http://localhost:8080/'
	},
	testDir: './tests',
	projects: [
		{
			name: 'setup db',
			testMatch: /global\.setup\.ts/
		},
		{
			name: 'login',
			testMatch: /login\.setup\.ts/
		},
		{
			name: 'user test',
			testMatch: /(.+\.)?(test|spec)\.[jt]s/,
			dependencies: ['setup db']
		}
	]
});
