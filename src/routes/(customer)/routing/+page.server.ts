import { toExpectedConnectionWithISOStrings } from '$lib/server/booking/taxi/bookRide';
import { Mode } from '$lib/server/booking/mode';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db, type Database } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm';
import { msg, type Msg } from '$lib/msg';
import { redirect } from '@sveltejs/kit';
import { sendMail } from '$lib/server/sendMail';
import NewRide from '$lib/server/email/NewRide.svelte';
import NewRideSharingRequest from '$lib/server/email/NewRideSharingRequest.svelte';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import type { SignedItinerary } from '$lib/planAndSign';
import { sql, type ExpressionBuilder } from 'kysely';
import type { PageServerLoad, PageServerLoadEvent } from './$types';
import Prom from 'prom-client';
import { rediscoverWhitelistRequestTimes } from '$lib/server/util/rediscoverWhitelistRequestTimes';
import { rideShareApi } from '$lib/server/booking/index';
import { expectedConnectionFromLeg } from '$lib/server/booking/expectedConnection';
import { isOdmLeg } from '$lib/util/booking/checkLegType';

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
		const tourIdString = formData.get('tourId');
		const json = formData.get('json');

		if (
			typeof json !== 'string' ||
			typeof luggageString !== 'string' ||
			typeof wheelchairsString !== 'string' ||
			typeof passengersString !== 'string' ||
			typeof kidsZeroToTwoString !== 'string' ||
			typeof kidsThreeToFourString !== 'string' ||
			typeof kidsFiveToSixString !== 'string' ||
			typeof startFixedString !== 'string'
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
		const firstOdmIndex = legs.findIndex(isOdmLeg);
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
		const lastOdmIndex = legs.findLastIndex(isOdmLeg);
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
			requestedTime1
		);
		const connection2 =
			firstOdmIndex === lastOdmIndex
				? null
				: expectedConnectionFromLeg(lastOdm, parsedJson.signature2, true, requestedTime2);

		console.log(
			'BOOKING: C1=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection1), null, '\t')
		);
		console.log(
			'BOOKING: C2=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection2), null, '\t')
		);

		const mode = connection1 !== null ? connection1.mode : connection2?.mode;
		let tourId = -1;
		if (mode === Mode.RIDE_SHARE) {
			if (typeof tourIdString !== 'string') {
				throw `invalid booking params, tourIdString: ${tourIdString} is not a string. `;
			}
			tourId = readInt(tourIdString);
		}
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
						kidsFiveToSix,
						tourId
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
		delete parsedJson.rideShareTourInfos;
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

		try {
			const getEvents = (eb: ExpressionBuilder<Database, 'request'>, outer: boolean) => [
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
					.select(outer ? 'eventGroup.scheduledTimeEnd' : 'eventGroup.scheduledTimeStart')
					.as('lastTime')
			];

			if (mode == Mode.TAXI) {
				console.log('SENDING EMAIL TO TAXI OWNERS');
				const rideInfo = await db
					.selectFrom('request')
					.innerJoin('tour', 'request.tour', 'tour.id')
					.innerJoin('vehicle', 'tour.vehicle', 'vehicle.id')
					.innerJoin('user', 'vehicle.company', 'user.companyId')
					.select((eb) => ['user.email', 'user.name', 'tour.id as tourId', ...getEvents(eb, false)])
					.where('request.id', '=', request1)
					.where('user.isTaxiOwner', '=', true)
					.execute();
				await Promise.all(rideInfo.map((r) => sendMail(NewRide, 'Neue Beförderung', r.email, r)));
			} else {
				console.log('SENDING EMAIL TO RIDE SHARE PROVIDER');
				const rideInfo = await db
					.selectFrom('request')
					.innerJoin('rideShareTour', 'request.rideShareTour', 'rideShareTour.id')
					.innerJoin('rideShareVehicle', 'rideShareTour.vehicle', 'rideShareVehicle.id')
					.innerJoin('user as provider', 'rideShareVehicle.owner', 'provider.id')
					.innerJoin('user as passenger', 'request.customer', 'passenger.id')
					.select((eb) => [
						'provider.email as providerMail',
						'provider.name as providerName',
						'passenger.email as passengerMail',
						'passenger.name as passengerName',
						'passenger.phone as passengerPhone',
						'rideShareTour.id as tourId',
						'rideShareTour.communicatedStart as journeyTime',
						...getEvents(eb, true),
						eb
							.selectFrom('event')
							.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
							.innerJoin('request', 'request.id', 'event.request')
							.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
							.orderBy('eventGroup.scheduledTimeStart', 'asc')
							.limit(1)
							.select('address')
							.as('journeyFirst'),
						eb
							.selectFrom('event')
							.innerJoin('eventGroup', 'eventGroup.id', 'event.eventGroupId')
							.innerJoin('request', 'request.id', 'event.request')
							.whereRef('request.rideShareTour', '=', 'rideShareTour.id')
							.orderBy('eventGroup.scheduledTimeStart', 'desc')
							.limit(1)
							.select('address')
							.as('journeyLast')
					])
					.where('request.id', '=', request1)
					.execute();
				await Promise.all(
					rideInfo.map((r) =>
						sendMail(NewRideSharingRequest, 'Neue Mitfahr-Anfrage', r.providerMail, r)
					)
				);
			}
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

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
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
		areas: (await areasGeoJSON()).rows[0],
		user: {
			name: event.locals.session?.name,
			email: event.locals.session?.email,
			phone: event.locals.session?.phone
		}
	};
};
