import { createStatistics } from '../src/lib/createStatistics';

async function main(): Promise<void> {
	createStatistics();
}

// Run the main function
main().catch((error) => {
	console.error('Error in main function:', error);
});
