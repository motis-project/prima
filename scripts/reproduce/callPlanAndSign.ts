import { PlanData } from '../../src/lib/openapi';
import { planAndSign } from '../../src/lib/planAndSign';

const query = {
	query: {
		time: '2025-11-24T22:58:54.831Z',
		arriveBy: true,
		fromPlace: '51.5267724,14.5193269',
		toPlace: '51.5322939,14.5345323',
		preTransitModes: ['WALK', 'RIDE_SHARING'],
		postTransitModes: ['WALK', 'RIDE_SHARING'],
		directModes: ['WALK', 'RIDE_SHARING'],
		luggage: 0,
		fastestDirectFactor: 1.6,
		maxMatchingDistance: 250,
		maxTravelTime: 1440,
		passengers: 2
	}
} as PlanData;
const baseUrl = 'http://localhost:5173';

async function main() {
	const response = await planAndSign(query.query, baseUrl);

	if (response !== undefined) {
		console.log('Adding ride share tour succeeded');
	}
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
