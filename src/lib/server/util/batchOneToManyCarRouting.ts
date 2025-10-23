import type { Coordinates } from '$lib/util/Coordinates';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';

export const batchOneToManyCarRouting = async (
	one: Coordinates,
	many: (Coordinates | undefined)[],
	startFixed: boolean,
	maxDuration?: number
) => {
	const batches = [];
	const batchSize = 100;
	let currentPos = 0;
	const definedIndices = many
		.map((m, i) => (m !== undefined ? i : undefined))
		.filter((m) => m !== undefined);
	const definedMany = many.filter((m) => m !== undefined);
	while (currentPos < many.length) {
		batches.push(
			oneToManyCarRouting(
				one,
				definedMany.slice(currentPos, Math.min(currentPos + batchSize, definedMany.length)),
				startFixed
			)
		);
		currentPos += batchSize;
	}
	const batchResponses = await Promise.all(batches);
	let result: (number | undefined)[] = [];
	batchResponses.forEach((batchResponse) => {
		result = result.concat(batchResponse);
	});
	const response: (number | undefined)[] = [];

	definedIndices.forEach((index, i) => {
		response[index] = result[i];
	});
	return response;
};
