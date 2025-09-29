import { db } from '$lib/server/db';
import type { Capacities } from '$lib/util/booking/Capacities';
import { retry } from '$lib/server/db/retryQuery';
import { DIRECT_FREQUENCY, DIRECT_RIDE_TIME_DIFFERENCE } from '$lib/constants';
import { bookSharedRide, type BookRideShareResponse, type ExpectedConnection } from './bookRide';
import { signEntry } from '../signEntry';
import { insertRideShareRequest } from './insertRideShareRequest';

export type BookingParameters = {
	connection1: ExpectedConnection | null;
	connection2: ExpectedConnection | null;
	capacities: Capacities;
};

function isSignatureInvalid(c: ExpectedConnection | null) {
	return (
		c !== null &&
		signEntry(
			c.start.lat,
			c.start.lng,
			c.target.lat,
			c.target.lng,
			c.startTime,
			c.targetTime,
			false
		) !== c.signature
	);
}

function getPossibleRequestedTimes(rt: number): number[] {
	const possibleRequestedTimes = [];
	const earliestPossibleRequestedTime1 = rt - 2 * DIRECT_RIDE_TIME_DIFFERENCE;
	const latestPossibleRequestedTime1 = rt + 2 * DIRECT_RIDE_TIME_DIFFERENCE;
	for (
		let requestedTimeCandidate = rt;
		requestedTimeCandidate >= earliestPossibleRequestedTime1;
		requestedTimeCandidate -= DIRECT_FREQUENCY
	) {
		possibleRequestedTimes.push(requestedTimeCandidate);
	}
	for (
		let requestedTimeCandidate = rt;
		requestedTimeCandidate <= latestPossibleRequestedTime1;
		requestedTimeCandidate += DIRECT_FREQUENCY
	) {
		possibleRequestedTimes.push(requestedTimeCandidate);
	}
	return possibleRequestedTimes.sort((t1, t2) => Math.abs(t1 - rt) - Math.abs(t2 - rt));
}

export async function rideShareApi(
	p: BookingParameters,
	customer: number,
	isLocalhost: boolean,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	skipPromiseCheck?: boolean
): Promise<{
	message?: string;
	status: number;
	request1Id?: number;
	request2Id?: number;
	cost?: number;
	passengerDuration?: number;
	approachPlusReturnDurationDelta?: number;
	fullyPayedDurationDelta?: number;
	waitingTime?: number;
}> {
	console.log(
		'RIDE SHARE API PARAMS: ',
		JSON.stringify(p, null, 2),
		JSON.stringify(customer, null, 2),
		JSON.stringify(isLocalhost, null, 2),
		JSON.stringify(kidsZeroToTwo, null, 2),
		JSON.stringify(kidsThreeToFour, null, 2),
		JSON.stringify(kidsFiveToSix, null, 2),
		JSON.stringify(skipPromiseCheck, null, 2)
	);
	if (p.connection1 == null && p.connection2 == null) {
		return {
			message: 'Es wurde weder eine Anfrage für die erste noch für die letzte Meile gestellt.',
			status: 204
		};
	}
	if (!isLocalhost && (isSignatureInvalid(p.connection1) || isSignatureInvalid(p.connection2))) {
		console.log(
			'Attempt to book with invalid signature.',
			JSON.stringify(p, null, 2),
			JSON.stringify(customer, null, 2),
			JSON.stringify(isLocalhost, null, 2),
			JSON.stringify(kidsZeroToTwo, null, 2),
			JSON.stringify(kidsThreeToFour, null, 2),
			JSON.stringify(kidsFiveToSix, null, 2),
			JSON.stringify(skipPromiseCheck, null, 2)
		);
		return { status: 403 };
	}
	let request1Id: number | undefined = undefined;
	let request2Id: number | undefined = undefined;
	let possibleRequestedTimes1: number[] = [];
	let possibleRequestedTimes2: number[] = [];
	let message: string | undefined = undefined;
	let success = false;
	if (p.connection1) {
		possibleRequestedTimes1 = getPossibleRequestedTimes(p.connection1.requestedTime);
	}
	if (p.connection2) {
		possibleRequestedTimes2 = getPossibleRequestedTimes(p.connection2.requestedTime);
	}
	const possibleRequestedTimes =
		possibleRequestedTimes1.length === 0 ? possibleRequestedTimes2 : possibleRequestedTimes1;
	for (const rt of possibleRequestedTimes) {
		if (p.connection2) {
			p.connection2!.requestedTime = rt;
		} else {
			p.connection1!.requestedTime = rt;
		}
		await retry(() =>
			db
				.transaction()
				.setIsolationLevel('serializable')
				.execute(async (trx) => {
					let firstConnection: undefined | BookRideShareResponse = undefined;
					let secondConnection: undefined | BookRideShareResponse = undefined;
					if (p.connection1 != null) {
						firstConnection = await bookSharedRide(
							p.connection1,
							p.capacities,
							trx,
							skipPromiseCheck
						);
						if (firstConnection == undefined) {
							message = 'Die Anfrage für die erste Meile kann nicht erfüllt werden.';
							return;
						}
					}
					if (p.connection2 != null) {
						let blockedProviderId: number | undefined = undefined;
						if (firstConnection != undefined) {
							blockedProviderId = firstConnection.best.tour;
						}
						secondConnection = await bookSharedRide(
							p.connection2,
							p.capacities,
							trx,
							skipPromiseCheck,
							blockedProviderId
						);
						if (secondConnection == undefined) {
							message = 'Die Anfrage für die zweite Meile kann nicht erfüllt werden.';
							return;
						}
					}
					if (firstConnection !== null && firstConnection !== undefined) {
						request1Id =
							(await insertRideShareRequest(
								firstConnection,
								p.capacities,
								p.connection1!,
								customer,
								p.connection1!.startFixed ? p.connection1!.startTime : p.connection1!.targetTime,
								p.connection1!.requestedTime,
								p.connection1!.startFixed,
								trx
							)) ?? null;
					}
					if (secondConnection != null && secondConnection !== undefined) {
						request2Id =
							(await insertRideShareRequest(
								secondConnection,
								p.capacities,
								p.connection2!,
								customer,
								p.connection2!.startFixed ? p.connection2!.startTime : p.connection2!.targetTime,
								p.connection2!.requestedTime,
								p.connection2!.startFixed,
								trx
							)) ?? null;
					}
					message = 'Die Anfrage wurde erfolgreich bearbeitet.';
					success = true;
					return;
				})
		);
		if (success) {
			break;
		}
		request1Id = undefined;
		request2Id = undefined;
	}
	if (message == undefined) {
		return { status: 500 };
	}
	return {
		message,
		request1Id,
		request2Id,
		status: success ? 200 : 400
	};
}
