import { getTours } from '$lib/server/db/getTours';
import { readInt } from '$lib/server/util/readForm.js';
import { json } from '@sveltejs/kit';

export const GET = async ({ locals, url }) => {
	const companyId = locals.session!.companyId!;
	const fromTime = readInt(url.searchParams.get('fromTime'));
	const toTime = readInt(url.searchParams.get('toTime'));

	if (isNaN(fromTime) || isNaN(toTime)) {
		return new Response(null, { status: 400 });
	}

	return json(await getTours(false, companyId, [fromTime, toTime]));
};
