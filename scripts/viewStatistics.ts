import { viewStatistics } from '../src/lib/getStatistics';

viewStatistics().catch((error) => {
	console.error('Error in main function:', error);
});
