import type { PageServerLoad } from './$types';
import { bookRide, toExpectedConnectionWithISOStrings } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import { db } from '$lib/server/db';
import { readFloat, readInt } from '$lib/server/util/readForm';
import { insertRequest } from '../../api/booking/query';
import { msg, type Msg } from '$lib/msg';
import { redirect } from '@sveltejs/kit';
import { sendMail } from '$lib/server/sendMail';
import NewRide from '$lib/server/email/NewRide.svelte';
import { lockTablesStatement } from '$lib/server/db/lockTables';
import type { Itinerary } from '$lib/openapi';
import { sql } from 'kysely';
import Prom from 'prom-client';

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

const getCommonTour = (l1: Set<number>, l2: Set<number>) => {
	for (const e of l1) {
		if (l2.has(e)) {
			return e;
		}
	}
	return undefined;
};

export const actions = {
	bookItineraryWithOdm: async ({ request, locals }): Promise<{ msg: Msg }> => {
		booking_attempts?.inc();
		const user = locals.session?.userId;
		if (!user) {
			return { msg: msg('accountDoesNotExist') };
		}

		const formData = await request.formData();

		const passengers = readInt(formData.get('passengers'));
		const kidsZeroToTwo = readInt(formData.get('kidsZeroToTwo'));
		const kidsThreeToFour = readInt(formData.get('kidsThreeToFour'));
		const kidsFiveToSix = readInt(formData.get('kidsFiveToSix'));
		const luggage = readInt(formData.get('luggage'));
		const wheelchairs = readInt(formData.get('wheelchairs'));
		const json = formData.get('json');
		const startFixed1 = formData.get('startFixed1');
		const startFixed2 = formData.get('startFixed2');
		const fromAddress1 = formData.get('fromAddress1');
		const toAddress1 = formData.get('toAddress1');
		const fromAddress2 = formData.get('fromAddress2');
		const toAddress2 = formData.get('toAddress2');
		const fromLat1 = readFloat(formData.get('fromLat1'));
		const fromLng1 = readFloat(formData.get('fromLng1'));
		const toLat1 = readFloat(formData.get('toLat1'));
		const toLng1 = readFloat(formData.get('toLng1'));
		const fromLat2 = readFloat(formData.get('fromLat2'));
		const fromLng2 = readFloat(formData.get('fromLng2'));
		const toLat2 = readFloat(formData.get('toLat2'));
		const toLng2 = readFloat(formData.get('toLng2'));
		const startTime1 = readInt(formData.get('startTime1'));
		const endTime1 = readInt(formData.get('endTime1'));
		const startTime2 = readInt(formData.get('startTime2'));
		const endTime2 = readInt(formData.get('endTime2'));

		console.log('BOOKING PARAMS =', {
			passengers,
			kidsZeroToTwo,
			kidsThreeToFour,
			kidsFiveToSix,
			luggage,
			wheelchairs,
			startFixed1,
			startFixed2,
			fromAddress1,
			toAddress1,
			fromAddress2,
			toAddress2,
			fromLat1,
			fromLng1,
			toLat1,
			toLng1,
			startTime1,
			endTime1,
			fromLat2,
			fromLng2,
			toLat2,
			toLng2,
			startTime2,
			endTime2,
			user
		});

		if (
			typeof json !== 'string' ||
			typeof startFixed1 !== 'string' ||
			typeof startFixed2 !== 'string' ||
			typeof fromAddress1 !== 'string' ||
			typeof toAddress1 !== 'string' ||
			typeof fromAddress2 !== 'string' ||
			typeof toAddress2 !== 'string' ||
			isNaN(fromLat1) ||
			isNaN(fromLng1) ||
			isNaN(toLat1) ||
			isNaN(toLng1) ||
			isNaN(startTime1) ||
			isNaN(endTime1) ||
			isNaN(fromLat2) ||
			isNaN(fromLng2) ||
			isNaN(toLat2) ||
			isNaN(toLng2) ||
			isNaN(startTime2) ||
			isNaN(endTime2) ||
			passengers <= kidsZeroToTwo + kidsThreeToFour + kidsFiveToSix
		) {
			booking_errors?.inc();
			throw 'invalid booking params';
		}

		let parsedJson: undefined | Itinerary = undefined;
		try {
			parsedJson = JSON.parse(json) as Itinerary;
		} catch (_) {
			console.log(
				'Unable to parse journey with odm as Itinerary: ',
				json,
				{ passengers },
				{ luggage },
				{ wheelchairs },
				{ startFixed1 },
				{ startFixed2 },
				{ fromAddress1 },
				{ toAddress1 },
				{ fromAddress2 },
				{ toAddress2 },
				{ fromLat1 },
				{ fromLng1 },
				{ toLat1 },
				{ toLng1 },
				{ startTime1 },
				{ endTime1 },
				{ fromLat2 },
				{ fromLng2 },
				{ toLat2 },
				{ toLng2 },
				{ startTime2 },
				{ endTime2 },
				{ user }
			);
			booking_errors?.inc();
			return { msg: msg('unknownError') };
		}

		const capacities: Capacities = {
			bikes: 0,
			luggage,
			passengers,
			wheelchairs
		};
		const start1 = { lat: fromLat1, lng: fromLng1, address: fromAddress1 };
		const target1 = { lat: toLat1, lng: toLng1, address: toAddress1 };
		const start2 = { lat: fromLat2, lng: fromLng2, address: fromAddress2 };
		const target2 = { lat: toLat2, lng: toLng2, address: toAddress2 };

		const connection1 = {
			start: start1,
			target: target1,
			startTime: startTime1,
			targetTime: endTime1
		};

		const onlyOne = start1.lat === start2.lat && start1.lng === start2.lng;
		const connection2 = onlyOne
			? null
			: {
					start: start2,
					target: target2,
					startTime: startTime2,
					targetTime: endTime2
				};

		console.log(
			'BOOKING: C1=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection1), null, '\t')
		);
		console.log(
			'BOOKING: C2=',
			JSON.stringify(toExpectedConnectionWithISOStrings(connection2), null, '\t')
		);

		let success = false;
		let message: Msg | undefined = undefined;
		let request1: number | null = null;
		let request2: number | null = null;
		await db.transaction().execute(async (trx) => {
			await lockTablesStatement(['tour', 'request', 'event', 'availability', 'vehicle']).execute(
				trx
			);

			let firstBooking = undefined;
			let secondBooking = undefined;
			if (connection1 != null) {
				firstBooking = await bookRide(connection1, capacities, startFixed1 === '1', trx);
				if (firstBooking == undefined) {
					console.log('FIRST BOOKING FAILED');
					message = onlyOne ? msg('bookingError') : msg('bookingError1');
					return;
				}
			}
			if (connection2 != null) {
				secondBooking = await bookRide(connection2, capacities, startFixed2 === '1', trx);
				if (secondBooking == undefined) {
					console.log('SECOND BOOKING FAILED');
					message = msg('bookingError2');
					return;
				}
			}
			if (
				connection1 != null &&
				connection2 != null &&
				firstBooking!.tour != undefined &&
				secondBooking!.tour != undefined
			) {
				const newTour = getCommonTour(firstBooking!.mergeTourList, secondBooking!.mergeTourList);
				if (newTour != undefined) {
					firstBooking!.tour = newTour;
					secondBooking!.tour = newTour;
				}
			}
			if (connection1 != null) {
				request1 = await insertRequest(
					firstBooking!.best,
					capacities,
					connection1,
					user,
					firstBooking!.eventGroupUpdateList,
					[...firstBooking!.mergeTourList],
					firstBooking!.pickupEventGroup,
					firstBooking!.dropoffEventGroup,
					firstBooking!.neighbourIds,
					firstBooking!.directDurations,
					kidsZeroToTwo,
					kidsThreeToFour,
					kidsFiveToSix,
					trx
				);
			}
			if (connection2 != null) {
				request2 = await insertRequest(
					secondBooking!.best,
					capacities,
					connection2,
					user,
					secondBooking!.eventGroupUpdateList,
					[...secondBooking!.mergeTourList],
					secondBooking!.pickupEventGroup,
					secondBooking!.dropoffEventGroup,
					secondBooking!.neighbourIds,
					secondBooking!.directDurations,
					kidsZeroToTwo,
					kidsThreeToFour,
					kidsFiveToSix,
					trx
				);
			}

			console.log('INSERTION DONE, SETTING SUCCESS=TRUE - REQUIESTS:', { request1, request2 });

			success = true;
			return;
		});

		if (success) {
			console.log('SAVING JOURNEY');
			const id = (
				await db
					.insertInto('journey')
					.values({
						user,
						json: parsedJson,
						request1: request1!,
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
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'asc')
							.limit(1)
							.select('address')
							.as('firstAddress'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'asc')
							.limit(1)
							.select('event.scheduledTimeStart')
							.as('firstTime'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'desc')
							.limit(1)
							.select('address')
							.as('lastAddress'),
						eb
							.selectFrom('event')
							.where('event.request', '=', request1)
							.orderBy('event.scheduledTimeStart', 'desc')
							.limit(1)
							.select('event.scheduledTimeStart')
							.as('lastTime')
					])
					.where('request.id', '=', request1!)
					.where('user.isTaxiOwner', '=', true)
					.execute();
				await Promise.all(rideInfo.map((r) => sendMail(NewRide, 'Neue Beförderung', r.email, r)));
			} catch {
				/* nothing we can do about this */
			}

			return redirect(302, `/bookings/${id}`);
		}
		booking_errors?.inc();
		return { msg: message! };
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
		let parsedJson: undefined | Itinerary = undefined;
		try {
			parsedJson = JSON.parse(json) as Itinerary;
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
