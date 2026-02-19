import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		poolOptions: {
			threads: {
				maxThreads: 1,
				minThreads: 1
			}
		} // Disable parallel threads
	}
});
