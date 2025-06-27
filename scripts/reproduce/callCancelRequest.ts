#!/usr/bin/env ts-node

import 'dotenv/config';
import { cancelRequest } from '../../src/lib/server/db/cancelRequest';

const parameters = {
	requestId: 372,
	userId: 1
};

async function main() {
	await cancelRequest(parameters.requestId, parameters.userId);
}

main().catch((err) => {
	console.error('Error during request cancellation:', err);
	process.exit(1);
});
