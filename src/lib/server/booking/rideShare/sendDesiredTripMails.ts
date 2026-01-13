import { PASSENGER_CHANGE_DURATION } from '$lib/constants';
import { db } from '$lib/server/db';
import { oneToManyCarRouting } from '$lib/server/util/oneToManyCarRouting';
import type { Coordinates } from '$lib/util/Coordinates';
import { sql } from 'kysely';
import MatchingRideOffer from '$lib/server/email/MatchingRideOffer.svelte';
import { carRouting } from '$lib/util/carRouting';

export async function sendDesiredTripMails(
	start: Coordinates,
	target: Coordinates,
	startTime: number,
	endTime: number,
	/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
	sendMail: (template: any, subject: string, email: string, props: any) => Promise<void>,
	tourId?: number
) {
	const desiredTrips = await db
		.selectFrom('desiredRideShare')
		.innerJoin('user', 'user.id', 'desiredRideShare.interestedUser')
		//.where('desiredRideShare.time', '<=', endTime)
		//.where('desiredRideShare.time', '>=', startTime)
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
	console.log(
		'abcd',
		desiredTrips.length,
		{ start },
		{ target },
		{ startTime },
		{ endTime },
		JSON.stringify(await db.selectFrom('desiredRideShare').selectAll().execute())
	);
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
		if (approachDurations[i] === undefined || returnDurations[i] === undefined) {
			continue;
		}
		const duration =
			directDuration + approachDurations[i]! + returnDurations[i]! + PASSENGER_CHANGE_DURATION * 2;
		if (duration > endTime - startTime) {
			continue;
		}
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
