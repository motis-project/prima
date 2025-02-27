import { getTours } from '$lib/server/db/getTours';
import { readInt } from '$lib/server/util/readForm.js';
import { json, error } from '@sveltejs/kit';

export const GET = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const fromTime = readInt(url.searchParams.get('fromTime'));
	const toTime = readInt(url.searchParams.get('toTime'));

	if (isNaN(fromTime) || isNaN(toTime)) {
		throw error(400, 'Bad request');
	}

	return json(await getTours(false, companyId, [fromTime, toTime]));
};
