import { getTours } from '$lib/server/db/getTours';
import { readInt } from '$lib/server/util/readForm.js';
import { error, json } from '@sveltejs/kit';

export const GET = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const fromTime = readInt(url.searchParams.get('fromTime'));
	const toTime = readInt(url.searchParams.get('toTime'));

	if (isNaN(fromTime) || isNaN(toTime)) {
		error(400, { message: 'Invalid time range' });
	}

	return json(await getTours(false, companyId, [fromTime, toTime]));
};
