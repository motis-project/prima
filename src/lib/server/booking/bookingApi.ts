import { db } from '$lib/server/db';
import {
	bookRide,
	type BookRideResponse,
	type ExpectedConnection
} from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import { signEntry } from '$lib/server/booking/signEntry';
import { insertRequest } from './insertRequest';
import { retry } from '../db/retryQuery';

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
			false
		) !== c.signature
	);
}

export async function bookingApi(
	p: BookingParameters,
	customer: number,
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
	taxiTime?: number;
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
		return { status: 403 };
	}
	let request1Id: number | undefined = undefined;
	let request2Id: number | undefined = undefined;
	let message: string | undefined = undefined;
	let success = false;
	let cost = -1;
	let passengerDuration = -1;
	let waitingTime = -1;
	let taxiTime = -1;
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
					taxiTime = firstConnection.best.taxiDuration;
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
					taxiTime = secondConnection.best.taxiDuration;
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
				if (firstConnection != null) {
					request1Id =
						(await insertRequest(
							firstConnection.best,
							p.capacities,
							p.connection1!,
							customer,
							firstConnection.mergeTourList,
							firstConnection.neighbourIds,
							firstConnection.directDurations,
							firstConnection.prevLegDurations,
							firstConnection.nextLegDurations,
							kidsZeroToTwo,
							kidsThreeToFour,
							kidsFiveToSix,
							kidsSevenToFourteen,
							firstConnection.scheduledTimes,
							trx
						)) ?? null;
				}
				if (secondConnection != null) {
					request2Id =
						(await insertRequest(
							secondConnection.best,
							p.capacities,
							p.connection2!,
							customer,
							secondConnection.mergeTourList,
							secondConnection.neighbourIds,
							secondConnection.directDurations,
							secondConnection.prevLegDurations,
							secondConnection.nextLegDurations,
							kidsZeroToTwo,
							kidsThreeToFour,
							kidsFiveToSix,
							kidsSevenToFourteen,
							secondConnection.scheduledTimes,
							trx
						)) ?? null;
				}
				message = 'Die Anfrage wurde erfolgreich bearbeitet.';
				success = true;
				return;
			})
	);
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
		taxiTime
	};
}
