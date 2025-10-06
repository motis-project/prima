import { env } from '$env/dynamic/public';
import type { PlanData } from '$lib/openapi';
import { plan } from '$lib/openapi/services.gen';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { json, type RequestEvent } from '@sveltejs/kit';
import { isOdmLeg } from '../../(customer)/routing/utils';

export const POST = async (event: RequestEvent) => {
	const q: PlanData = await event.request.json();
	const r = await plan({
		baseUrl: env.PUBLIC_MOTIS_URL,
		querySerializer: { array: { explode: false } } as QuerySerializerOptions,
		query: q.query
	});
	const response = r.data;
	console.log(r.request);
	if (response === undefined) {
		return json({});
	}
	return json({
		...response!,
		itineraries: response!.itineraries.map((i) => {
			const odmLeg1 = i.legs.find((l) => isOdmLeg);
			const odmLeg2 = i.legs.findLast((l) => isOdmLeg);
			return {
				...i,
				signature1:
					odmLeg1 !== undefined
						? signEntry(
								odmLeg1.from.lat,
								odmLeg1.from.lon,
								odmLeg1.to.lat,
								odmLeg1.to.lon,
								new Date(odmLeg1.startTime).getTime(),
								new Date(odmLeg1.endTime).getTime(),
								false
							)
						: undefined,
				signature2:
					odmLeg2 !== undefined
						? signEntry(
								odmLeg2.from.lat,
								odmLeg2.from.lon,
								odmLeg2.to.lat,
								odmLeg2.to.lon,
								new Date(odmLeg2.startTime).getTime(),
								new Date(odmLeg2.endTime).getTime(),
								true
							)
						: undefined
			};
		})
	});
};
