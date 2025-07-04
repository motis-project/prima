export async function retry<T>(fn: () => Promise<T>, maxRetries = 15): Promise<T> {
	let attempt = 0;
	while (true) {
		try {
			return await fn();
		} catch (err) {
			const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
			const isRetryable = code === '40001' || code === '40P01';
			if (!isRetryable || attempt >= maxRetries) throw err;
			attempt++;
			const delay = 1000 * Math.pow(1.5, attempt);
			console.warn(`[RETRY] Attempt ${attempt} failed with code ${code}, retrying in ${delay}ms`);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
}
