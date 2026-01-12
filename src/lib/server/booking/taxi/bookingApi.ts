import { db } from '$lib/server/db';
import { bookRide, type BookRideResponse } from '$lib/server/booking/taxi/bookRide';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import type { Capacities } from '$lib/util/booking/Capacities';
import { signEntry } from '$lib/server/booking/signEntry';
import { insertRequest } from './insertRequest';
import { retry } from '$lib/server/db/retryQuery';
import { DIRECT_FREQUENCY, DIRECT_RIDE_TIME_DIFFERENCE } from '$lib/constants';

export type BookingParameters = {
	connection1: ExpectedConnection | null;
	connection2: ExpectedConnection | null;
	capacities: Capacities;
};

const getCommonTour = (l1: number[], l2: number[]) => {
	for (const e of l1) {
		if (l2.find((l) => l === e)) {
			return e;
		}
	}
	return undefined;
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
			false,
			JSON.stringify(c.requestedTime / 1000)
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

export async function bookingApi(
	p: BookingParameters,
	customer: number,
	withoutQr: boolean,
	isLocalhost: boolean,
	kidsZeroToTwo: number,
	kidsThreeToFour: number,
	kidsFiveToSix: number,
	kidsSevenToFourteen: number,
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
		'BOOKING API PARAMS: ',
		JSON.stringify(p, null, 2),
		JSON.stringify(customer, null, 2),
		JSON.stringify(isLocalhost, null, 2),
		JSON.stringify(kidsZeroToTwo, null, 2),
		JSON.stringify(kidsThreeToFour, null, 2),
		JSON.stringify(kidsFiveToSix, null, 2),
		JSON.stringify(kidsSevenToFourteen, null, 2),
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
	let cost = -1;
	let passengerDuration = -1;
	let waitingTime = -1;
	let approachPlusReturnDurationDelta = -1;
	let fullyPayedDurationDelta = -1;
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
					let firstConnection: undefined | BookRideResponse = undefined;
					let secondConnection: undefined | BookRideResponse = undefined;
					if (p.connection1 != null) {
						firstConnection = await bookRide(p.connection1, p.capacities, trx, skipPromiseCheck);
						if (firstConnection == undefined) {
							message = 'Die Anfrage für die erste Meile kann nicht erfüllt werden.';
							return;
						}
						cost = firstConnection.best.cost;
						passengerDuration = firstConnection.best.passengerDuration;
						approachPlusReturnDurationDelta = firstConnection.best.approachPlusReturnDurationDelta;
						fullyPayedDurationDelta = firstConnection.best.fullyPayedDurationDelta;
						waitingTime = firstConnection.best.taxiWaitingTime;
					}
					if (p.connection2 != null) {
						let blockedVehicleId: number | undefined = undefined;
						if (firstConnection != undefined) {
							blockedVehicleId = firstConnection.best.vehicle;
						}
						secondConnection = await bookRide(
							p.connection2,
							p.capacities,
							trx,
							skipPromiseCheck,
							blockedVehicleId
						);
						if (secondConnection == undefined) {
							message = 'Die Anfrage für die zweite Meile kann nicht erfüllt werden.';
							return;
						}
						cost = secondConnection.best.cost;
						passengerDuration = secondConnection.best.passengerDuration;
						approachPlusReturnDurationDelta = secondConnection.best.approachPlusReturnDurationDelta;
						fullyPayedDurationDelta = secondConnection.best.fullyPayedDurationDelta;
						waitingTime = secondConnection.best.taxiWaitingTime;
					}
					if (
						p.connection1 != null &&
						p.connection2 != null &&
						firstConnection!.tour != undefined &&
						secondConnection!.tour != undefined
					) {
						const newTour = getCommonTour(
							firstConnection!.mergeTourList,
							secondConnection!.mergeTourList
						);
						if (newTour != undefined) {
							firstConnection!.tour = newTour;
							secondConnection!.tour = newTour;
						}
					}
					if (firstConnection !== null && firstConnection !== undefined) {
						request1Id =
							(await insertRequest(
								firstConnection,
								p.capacities,
								p.connection1!,
								customer,
								withoutQr,
								kidsZeroToTwo,
								kidsThreeToFour,
								kidsFiveToSix,
								kidsSevenToFourteen,
								trx
							)) ?? null;
					}
					if (secondConnection != null && secondConnection !== undefined) {
						request2Id =
							(await insertRequest(
								secondConnection,
								p.capacities,
								p.connection2!,
								customer,
								withoutQr,
								kidsZeroToTwo,
								kidsThreeToFour,
								kidsFiveToSix,
								kidsSevenToFourteen,
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
		cost = -1;
		passengerDuration = -1;
		waitingTime = -1;
		approachPlusReturnDurationDelta = -1;
		fullyPayedDurationDelta = -1;
	}
	if (message == undefined) {
		return { status: 500 };
	}
	return {
		message,
		request1Id,
		request2Id,
		status: success ? 200 : 400,
		cost,
		passengerDuration,
		waitingTime,
		approachPlusReturnDurationDelta,
		fullyPayedDurationDelta
	};
}
