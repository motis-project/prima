import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		testTimeout: 70_000,
		include: ['src/**/*.{test,spec}.{js,ts}'],
		testTimeout: 70_000,
		poolOptions: {
			threads: {
				maxThreads: 1,
				minThreads: 1
			}
		} // Disable parallel threads
	}
});
