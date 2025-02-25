import type { Coordinates } from '$lib/util/Coordinates';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';

export const batchOneToManyCarRouting = async (
	one: Coordinates,
	many: Coordinates[],
	startFixed: boolean
) => {
	const batches = [];
	const batchSize = 100;
	let currentPos = 0;
	while (currentPos < many.length) {
		batches.push(
			oneToManyCarRouting(
				one,
				many.slice(currentPos, Math.min(currentPos + batchSize, many.length)),
				startFixed
			)
		);
		currentPos += batchSize;
	}
	const batchResponses = await Promise.all(batches);
	let response: (number | undefined)[] = [];
	batchResponses.forEach((batchResponse) => {
		response = response.concat(batchResponse);
	});
	return response;
};
