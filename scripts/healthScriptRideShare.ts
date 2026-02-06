import { healthCheck } from '../src/lib/server/util/healthCheckRideShare';

async function main(): Promise<void> {
	healthCheck();
}

// Run the main function
main().catch((error) => {
	console.error('Error in main function:', error);
});
