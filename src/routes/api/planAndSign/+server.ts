import { env } from '$env/dynamic/public';
import { SCHEDULED_TIME_BUFFER } from '$lib/constants';
import type { PlanData } from '$lib/openapi';
import { plan } from '$lib/openapi/services.gen';
import { signEntry } from '$lib/server/booking/signEntry';
import type { QuerySerializerOptions } from '@hey-api/client-fetch';
import { json, type RequestEvent } from '@sveltejs/kit';

export const POST = async (event: RequestEvent) => {
	const q: PlanData = await event.request.json();
	const response = (
		await plan({
			baseUrl: env.PUBLIC_MOTIS_URL,
			querySerializer: { array: { explode: false } } as QuerySerializerOptions,
			query: q.query
		})
	).data;
	if (response === undefined) {
		return json({});
	}
	return json({
		...response!,
		itineraries: response!.itineraries.map((i) => {
			const odmIndex1 = i.legs.findIndex((l) => l.mode === 'ODM');
			const odmIndex2 = i.legs.findLastIndex((l) => l.mode === 'ODM');
			const odmLeg1 = i.legs.find((l) => l.mode === 'ODM');
			const odmLeg2 = i.legs.findLast((l) => l.mode === 'ODM');
			if (odmLeg1) {
				i.legs[odmIndex1] = {
					...odmLeg1!,
					scheduledStartTime: new Date(
						new Date(odmLeg1!.scheduledStartTime).getTime() - SCHEDULED_TIME_BUFFER
					).toISOString(),
					scheduledEndTime: new Date(
						new Date(odmLeg1!.scheduledEndTime).getTime() + SCHEDULED_TIME_BUFFER
					).toISOString()
				};
			}
			if (odmLeg2) {
				i.legs[odmIndex2] = {
					...odmLeg2!,
					scheduledStartTime: new Date(
						new Date(odmLeg2!.scheduledStartTime).getTime() - SCHEDULED_TIME_BUFFER
					).toISOString(),
					scheduledEndTime: new Date(
						new Date(odmLeg2!.scheduledEndTime).getTime() + SCHEDULED_TIME_BUFFER
					).toISOString()
				};
			}
			return {
				...i,
				startTime:
					odmIndex1 === 0
						? new Date(new Date(i.startTime).getTime() - SCHEDULED_TIME_BUFFER)
						: i.startTime,
				endTime:
					odmIndex1 === 0
						? new Date(new Date(i.endTime).getTime() + SCHEDULED_TIME_BUFFER)
						: i.endTime,
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
