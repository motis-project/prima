import { toExpectedConnectionWithISOStrings } from '$lib/server/booking/taxi/bookRide';
import { Mode } from '$lib/server/booking/mode';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm';
import { msg, type Msg } from '$lib/msg';
import { redirect } from '@sveltejs/kit';
import { sendMail } from '$lib/server/sendMail';
import NewRide from '$lib/server/email/NewRide.svelte';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import type { Leg } from '$lib/openapi';
import type { SignedItinerary } from '$lib/planAndSign';
import { sql } from 'kysely';
import type { PageServerLoad } from './$types';
import Prom from 'prom-client';
import { rediscoverWhitelistRequestTimes } from '$lib/server/util/rediscoverWhitelistRequestTimes';
import { rideShareApi } from '$lib/server/booking/index';
import { expectedConnectionFromLeg } from '$lib/server/booking/rideShare/expectedConnectionFromLeg';

let booking_errors: Prom.Counter | undefined;
let booking_attempts: Prom.Counter | undefined;

try {
	booking_errors = new Prom.Counter({
		name: 'prima_booking_errors_total',
		help: 'Booking errors occurred'
	});
	booking_attempts = new Prom.Counter({
		name: 'prima_booking_attempts_total',
		help: 'Booking attempts occurred'
	});
} catch {
	/* ignored */
}

export const actions = {
	bookItineraryWithOdm: async ({ request, locals }): Promise<{ msg: Msg }> => {
		booking_attempts?.inc();
		const user = locals.session?.userId;
		if (!user) {
			return { msg: msg('accountDoesNotExist') };
		}

		const formData = await request.formData();

		const passengersString = formData.get('passengers');
		const luggageString = formData.get('luggage');
		const wheelchairsString = formData.get('wheelchairs');
		const kidsZeroToTwoString = formData.get('kidsZeroToTwo');
		const kidsThreeToFourString = formData.get('kidsThreeToFour');
		const kidsFiveToSixString = formData.get('kidsFiveToSix');
		const startFixedString = formData.get('startFixed');
		const tourIdString = formData.get('tourIdString');
		const json = formData.get('json');

		if (
			typeof json !== 'string' ||
			typeof luggageString !== 'string' ||
			typeof wheelchairsString !== 'string' ||
			typeof passengersString !== 'string' ||
			typeof kidsZeroToTwoString !== 'string' ||
			typeof kidsThreeToFourString !== 'string' ||
			typeof kidsFiveToSixString !== 'string' ||
			typeof startFixedString !== 'string' ||
			typeof tourIdString !== 'string'
		) {
			booking_errors?.inc();
			throw 'invalid booking params';
		}
		const luggage = readInt(luggageString);
		const wheelchairs = readInt(wheelchairsString);
		const passengers = readInt(passengersString);
		const kidsZeroToTwo = readInt(kidsZeroToTwoString);
		const kidsThreeToFour = readInt(kidsThreeToFourString);
		const kidsFiveToSix = readInt(kidsFiveToSixString);
		const tourId = readInt(tourIdString);
		const startFixed = startFixedString === '1';

		if (
			isNaN(luggage) ||
			isNaN(wheelchairs) ||
			isNaN(passengers) ||
			isNaN(kidsZeroToTwo) ||
			isNaN(kidsThreeToFour) ||
			isNaN(kidsFiveToSix) ||
			(startFixedString !== '1' && startFixedString !== '0')
		) {
			throw 'invalid booking params';
		}

		const capacities: Capacities = {
			bikes: 0,
			luggage,
			passengers,
			wheelchairs
		};

		let parsedJson: SignedItinerary | undefined = undefined;
		try {
			parsedJson = JSON.parse(json) as SignedItinerary;
		} catch (_) {
			console.log(
				'Unable to parse json as Itinerary in bookItineraryWithOdm action. ',
				{ json },
				{ user },
				{ capacities },
				{ kidsZeroToTwo },
				{ kidsThreeToFour },
				{ kidsFiveToSix }
			);
			booking_errors?.inc();
			return { msg: msg('unknownError') };
		}

		const legs = parsedJson!.legs;
		const firstOdmIndex = legs.findIndex((l: Leg) => l.mode === 'ODM');
		if (firstOdmIndex === -1) {
			console.log(
				'Journey with no ODM in bookItineraryWithOdm action. ',
				{ json },
				{ user },
				{ capacities },
				{ kidsZeroToTwo },
				{ kidsThreeToFour },
				{ kidsFiveToSix }
			);
			booking_errors?.inc();
			return { msg: msg('unknownError') };
		}
		const firstOdm = legs[firstOdmIndex];
		const lastOdmIndex = legs.findLastIndex((l: Leg) => l.mode === 'ODM');
		const lastOdm = legs[lastOdmIndex];
		if (!parsedJson.signature1) {
			console.log(
				'Missing signature for connection1 in bookItineraryWithOdm action. ',
				{ json },
				{ user },
				{ capacities },
				{ kidsZeroToTwo },
				{ kidsThreeToFour },
				{ kidsFiveToSix }
			);
			return { msg: msg('unknownError') };
		}
		const isDirect = legs.length === 1;

		const { requestedTime1, requestedTime2 } = rediscoverWhitelistRequestTimes(
			startFixed,
			isDirect,
			firstOdmIndex,
			lastOdmIndex,
			legs
		);

		console.log({ isDirect }, { startFixed });
		const connection1 = expectedConnectionFromLeg(
			firstOdm,
			parsedJson.signature1,
			isDirect ? startFixed : firstOdmIndex !== 0,
			requestedTime1,
			tourId
		);
		const connection2 =
			firstOdmIndex === lastOdmIndex
				? null
				: expectedConnectionFromLeg(lastOdm, parsedJson.signature2, true, requestedTime2, tourId);

		console.log(
			'BOOKING: C1=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection1), null, '\t')
		);
		console.log(
			'BOOKING: C2=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection2), null, '\t')
		);

		const mode = connection1 !== null ? connection1.mode : connection2?.mode;
		const bookingResult =
			mode === Mode.TAXI
				? await bookingApi(
						{ connection1, connection2, capacities },
						user,
						locals.session?.isService ?? false,
						false,
						kidsZeroToTwo,
						kidsThreeToFour,
						kidsFiveToSix
					)
				: await rideShareApi(
						{ connection1, connection2, capacities },
						user,
						locals.session?.isService ?? false,
						kidsZeroToTwo,
						kidsThreeToFour,
						kidsFiveToSix
					);
		if (bookingResult.status !== 200) {
			console.log(
				'Booking failed: ',
				bookingResult.message,
				' with: ',
				{ connection1 },
				{ connection2 }
			);
			return { msg: msg('bookingError') };
		}
		const request1: number | null = bookingResult.request1Id ?? null;
		const request2: number | null = bookingResult.request2Id ?? null;
		console.log('INSERTION DONE - REQUESTS:', { request1, request2 });

		console.log('SAVING JOURNEY');
		const id = (
			await db
				.insertInto('journey')
				.values({
					user,
					json: parsedJson,
					request1,
					request2
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;

		console.log('SENDING EMAIL TO TAXI OWNERS');
		try {
			const rideInfo = await db
				.selectFrom('request')
				.innerJoin('tour', 'request.tour', 'tour.id')
				.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
				.innerJoin('user', 'vehicle.company', 'user.companyId')
				.select((eb) => [
					'user.email',
					'user.name',
					'tour.id as tourId',
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.where('event.request', '=', request1)
						.orderBy('eventGroup.scheduledTimeStart', 'asc')
						.limit(1)
						.select('address')
						.as('firstAddress'),
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.where('event.request', '=', request1)
						.orderBy('eventGroup.scheduledTimeStart', 'asc')
						.limit(1)
						.select('eventGroup.scheduledTimeStart')
						.as('firstTime'),
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.where('event.request', '=', request1)
						.orderBy('eventGroup.scheduledTimeStart', 'desc')
						.limit(1)
						.select('address')
						.as('lastAddress'),
					eb
						.selectFrom('event')
						.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
						.where('event.request', '=', request1)
						.orderBy('eventGroup.scheduledTimeStart', 'desc')
						.limit(1)
						.select('eventGroup.scheduledTimeStart')
						.as('lastTime')
				])
				.where('request.id', '=', request1)
				.where('user.isTaxiOwner', '=', true)
				.execute();
			await Promise.all(rideInfo.map((r) => sendMail(NewRide, 'Neue Beförderung', r.email, r)));
		} catch {
			/* nothing we can do about this */
		}
		return redirect(302, `/bookings/${id}`);
	},
	storeItineraryWithNoOdm: async ({ request, locals }): Promise<{ msg: Msg }> => {
		const user = locals.session?.userId;
		if (!user) {
			return { msg: msg('accountDoesNotExist') };
		}

		const formData = await request.formData();
		const json = formData.get('json');
		console.log('SAVING JOURNEY');
		if (typeof json != 'string') {
			return { msg: msg('unknownError') };
		}
		let parsedJson: undefined | SignedItinerary = undefined;
		try {
			parsedJson = JSON.parse(json) as SignedItinerary;
		} catch (_) {
			console.log('Unable to parse journey with no odm as Itinerary: ', json, { user });
			return { msg: msg('unknownError') };
		}
		const id = (
			await db
				.insertInto('journey')
				.values({
					user,
					json: parsedJson,
					request1: null,
					request2: null
				})
				.returning('id')
				.executeTakeFirstOrThrow()
		).id;
		return redirect(302, `/bookings/${id}`);
	}
};

export const load: PageServerLoad = async () => {
	const areasGeoJSON = async () => {
		return await sql`
		SELECT 'FeatureCollection' AS TYPE,
			array_to_json(array_agg(f)) AS features
		FROM
			(SELECT 'Feature' AS TYPE,
				ST_AsGeoJSON(lg.area, 15, 0)::json As geometry,
				json_build_object('id', lg.id, 'name', lg.name) AS properties
			FROM zone AS lg WHERE EXISTS (SELECT company.id FROM company WHERE lg.id = company.zone )) AS f`.execute(
			db
		);
	};

	return {
		areas: (await areasGeoJSON()).rows[0]
	};
};
