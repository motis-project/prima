import { acceptRideShareRequest } from '../../src/lib/server/booking';

const params = {
	request: 12,
	provider: 1
};

async function main() {
	const response = await acceptRideShareRequest(params.request, params.provider);

	if (response.status === 200) {
		console.log('Accepting ride share request succeeded');
	}
}

main().catch((err) => {
	console.error('Error during booking:', err);
	process.exit(1);
});
