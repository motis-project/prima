import { MAX_PASSENGER_WAITING_TIME_PICKUP, PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { db } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import type { Coordinates } from '$lib/util/Coordinates';
import { sql } from 'kysely';
import MatchingRideOffer from '$lib/server/email/MatchingRideOffer.svelte';
import { carRouting } from '$lib/util/carRouting';
import { DAY } from '$lib/util/time';
import { evaluateSingleInsertions } from './insertion';
import { getRideShareTours } from './getRideShareTours';
import type { Range } from '$lib/util/booking/getPossibleInsertions';
import { Interval } from '$lib/util/interval';
import type { RoutingResults } from './routing';
import { isSamePlace } from '$lib/util/booking/isSamePlace';

export async function sendDesiredTripMails(
	start: Coordinates,
	target: Coordinates,
	startTime: number,
	endTime: number,
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	sendMail: (template: any, subject: string, email: string, props: any) => Promise<void>,
	startFixed: boolean,
	tourId?: number
) {
	const desiredTrips = await db
		.selectFrom('desiredRideShare')
		.innerJoin('user', 'user.id', 'desiredRideShare.interestedUser')
		.where('desiredRideShare.time', '<=', endTime + DAY)
		.where('desiredRideShare.time', '>=', startTime - DAY)
		.$if(tourId !== undefined, (qb) =>
			qb.where((eb) =>
				eb.exists(
					eb
						.selectFrom('rideShareTour')
						.whereRef('rideShareTour.passengers', '>=', 'desiredRideShare.passengers')
						.where('rideShareTour.id', '=', tourId!)
						.where((eb) =>
							eb(
								'rideShareTour.luggage',
								'>=',
								sql<number>`${eb.ref('desiredRideShare.luggage')} + ${eb.ref('desiredRideShare.passengers')} - ${eb.ref('rideShareTour.passengers')}`
							)
						)
				)
			)
		)
		.selectAll()
		.execute();

	const rideShareTour = (
		await getRideShareTours(
			{ wheelchairs: 0, bikes: 0, passengers: 0, luggage: 0 },
			new Interval(startTime - DAY, endTime + DAY),
			undefined,
			tourId
		)
	)[0];
	const approachDurations = await oneToManyCarRouting(
		start,
		desiredTrips.map((t) => {
			return { lat: t.fromLat, lng: t.fromLng };
		}),
		false
	);
	const returnDurations = await oneToManyCarRouting(
		target,
		desiredTrips.map((t) => {
			return { lat: t.toLat, lng: t.toLng };
		}),
		true
	);
	const directDuration = (await carRouting(start, target))?.duration;
	if (directDuration === undefined) {
		return;
	}
	const mails = [];
	for (let i = 0; i != desiredTrips.length; ++i) {
		const insertionRanges = new Map<number, Range[]>();
		insertionRanges.set(rideShareTour.rideShareTour, [{ earliestPickup: 1, latestDropoff: 1 }]);
		const times = [
			[
				new Interval(
					startFixed ? startTime : endTime - MAX_PASSENGER_WAITING_TIME_PICKUP,
					startFixed ? startTime + MAX_PASSENGER_WAITING_TIME_PICKUP : endTime
				)
			]
		];
		const startChangeDuration = isSamePlace(
			{ lat: desiredTrips[i].fromLat, lng: desiredTrips[i].fromLng },
			start
		)
			? PASSENGER_CHANGE_DURATION
			: 0;
		const targetChangeDuration = isSamePlace(
			{ lat: desiredTrips[i].toLat, lng: desiredTrips[i].toLng },
			target
		)
			? PASSENGER_CHANGE_DURATION
			: 0;
		const routingResults: RoutingResults = {
			busStops: {
				fromBusStop: [
					[
						startFixed
							? undefined
							: approachDurations[i]
								? approachDurations[i]! + startChangeDuration
								: undefined
					]
				],
				toBusStop: [
					[
						startFixed
							? returnDurations[i]
								? returnDurations[i]! + startChangeDuration
								: undefined
							: undefined
					]
				]
			},
			userChosen: {
				fromUserChosen: [
					startFixed
						? approachDurations[i]
							? approachDurations[i]! + targetChangeDuration
							: undefined
						: undefined
				],
				toUserChosen: [
					startFixed
						? undefined
						: returnDurations[i]
							? returnDurations[i]! + targetChangeDuration
							: undefined
				]
			}
		};
		const result = evaluateSingleInsertions(
			[rideShareTour],
			startFixed,
			insertionRanges,
			times,
			routingResults,
			[directDuration]
		);
		if (result.bothEvaluations[0][0].length === 0) {
			continue;
		}
		console.log('sending mail', JSON.stringify(desiredTrips[i]));
		mails.push(
			sendMail(
				MatchingRideOffer,
				'Passendes Mitfahrangebot',
				desiredTrips[i].email,
				desiredTrips[i]
			)
		);
	}
	Promise.all(mails);
}
