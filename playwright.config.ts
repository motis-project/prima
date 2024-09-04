import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		port: 4173,
		reuseExistingServer: true
	},
	testDir: './tests',
	projects: [
		{
			name: 'setup db',
			testMatch: /global\.setup\.ts/
		},
		{
			name: 'user test',
			testMatch: /(.+\.)?(test|spec)\.[jt]s/,
			dependencies: ['setup db']
		}
	]
};

export default config;
