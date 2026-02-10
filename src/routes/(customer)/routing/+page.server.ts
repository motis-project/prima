import { toExpectedConnectionWithISOStrings } from '$lib/server/booking/taxi/bookRide';
import { Mode } from '$lib/server/booking/mode';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db } from '$lib/server/db';
import { readInt } from '$lib/server/util/readForm';
import { msg, type Msg } from '$lib/msg';
import { redirect } from '@sveltejs/kit';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import type { SignedItinerary } from '$lib/planAndSign';
import type { PageServerLoad, PageServerLoadEvent } from './$types';
import Prom from 'prom-client';
import { rediscoverWhitelistRequestTimes } from '$lib/server/util/rediscoverWhitelistRequestTimes';
import { rideShareApi } from '$lib/server/booking/index';
import { expectedConnectionFromLeg } from '$lib/server/booking/expectedConnection';
import { isOdmLeg } from '$lib/util/booking/checkLegType';
import { sendMail } from '$lib/server/sendMail';
import { sendBookingMails } from '$lib/util/sendBookingEmails';
import type { CalibrationItinerary } from '$lib/calibration';
import { areasGeoJSON, rideshareGeoJSON } from '$lib/util/geoJSON';

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
		const kidsSevenToFourteenString = formData.get('kidsSevenToFourteen');
		const startFixedString = formData.get('startFixed');
		const json = formData.get('json');

		if (
			typeof json !== 'string' ||
			typeof luggageString !== 'string' ||
			typeof wheelchairsString !== 'string' ||
			typeof passengersString !== 'string' ||
			typeof kidsZeroToTwoString !== 'string' ||
			typeof kidsThreeToFourString !== 'string' ||
			typeof kidsFiveToSixString !== 'string' ||
			typeof kidsSevenToFourteenString !== 'string' ||
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
		const kidsSevenToFourteen = readInt(kidsSevenToFourteenString);
		const startFixed = startFixedString === '1';

		if (
			isNaN(luggage) ||
			isNaN(wheelchairs) ||
			isNaN(passengers) ||
			isNaN(kidsZeroToTwo) ||
			isNaN(kidsThreeToFour) ||
			isNaN(kidsFiveToSix) ||
			isNaN(kidsSevenToFourteen) ||
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
				{ kidsFiveToSix },
				{ kidsSevenToFourteen }
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
				{ kidsFiveToSix },
				{ kidsSevenToFourteen }
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
				{ kidsFiveToSix },
				{ kidsSevenToFourteen }
			);
			booking_errors?.inc();
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

		const bookingResult =
			mode === Mode.TAXI
				? await bookingApi(
						{ connection1, connection2, capacities },
						user,
						locals.session?.isService ?? false,
						false,
						kidsZeroToTwo,
						kidsThreeToFour,
						kidsFiveToSix,
						kidsSevenToFourteen
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
			booking_errors?.inc();
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
		await sendBookingMails(request1, mode, db, sendMail);
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
	},
	useForCalibration: async ({ request, locals }): Promise<{ msg: Msg }> => {
		if (!locals.session?.isAdmin) {
			return { msg: msg('requiresAdminPrivileges') };
		}

		const formData = await request.formData();
		const name = formData.get('name');
		const json = formData.get('json');

		if (typeof name != 'string' || typeof json != 'string') {
			return { msg: msg('unknownError') };
		}
		let itineraries: undefined | Array<CalibrationItinerary>;
		try {
			itineraries = JSON.parse(json) as Array<CalibrationItinerary>;
		} catch (_) {
			console.log('Unable to parse calibration itineraries: ', json);
			return { msg: msg('unknownError') };
		}

		const itinerariesJson = JSON.stringify(itineraries);
		await db.insertInto('calibrationSets').values({ name, itinerariesJson }).execute();
		return redirect(303, '/admin/calibration');
	}
};

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
	const lastAvailability = await db
		.selectFrom('availability')
		.select('availability.endTime')
		.orderBy('availability.endTime', 'desc')
		.executeTakeFirst();
	const userId = event.locals.session?.userId;
	const ownRideShareOfferIds =
		userId === undefined
			? undefined
			: await db
					.selectFrom('rideShareTour')
					.select('rideShareTour.id')
					.innerJoin('rideShareVehicle', 'rideShareVehicle.id', 'rideShareTour.vehicle')
					.where('rideShareVehicle.owner', '=', userId)
					.execute();

	return {
		areas: (await areasGeoJSON()).rows[0],
		rideSharingBounds: (await rideshareGeoJSON()).rows[0],
		user: {
			name: event.locals.session?.name,
			email: event.locals.session?.email,
			phone: event.locals.session?.phone,
			id: event.locals.session?.id,
			ownRideShareOfferIds
		},
		lastAvailability
	};
};
