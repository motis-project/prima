import { db } from '$lib/server/db';
import { bookRide, type ExpectedConnection } from '$lib/server/booking/bookRide';
import type { Capacities } from '$lib/util/booking/Capacities';
import { lockTablesStatement } from '$lib/server/db/lockTables';
import { signEntry } from '$lib/server/booking/signEntry';
import { insertRequest } from './insertRequest';

export type BookingParameters = {
	connection1: ExpectedConnection | null;
	connection2: ExpectedConnection | null;
	capacities: Capacities;
};

const getCommonTour = (l1: Set<number>, l2: Set<number>) => {
	for (const e of l1) {
		if (l2.has(e)) {
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
	kidsFiveToSix: number
): Promise<{
	message?: string;
	status: number;
	request1Id?: number;
	request2Id?: number;
}> {
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
	await db.transaction().execute(async (trx) => {
		await lockTablesStatement(['tour', 'request', 'event', 'availability', 'vehicle']).execute(trx);
		let firstConnection = undefined;
		let secondConnection = undefined;
		if (p.connection1 != null) {
			firstConnection = await bookRide(p.connection1, p.capacities, false, trx);
			if (firstConnection == undefined) {
				message = 'Die Anfrage für die erste Meile kann nicht erfüllt werden.';
				return;
			}
		}
		if (p.connection2 != null) {
			let blockedVehicleId: number | undefined = undefined;
			if (firstConnection != undefined) {
				blockedVehicleId = firstConnection.best.vehicle;
			}
			secondConnection = await bookRide(p.connection2, p.capacities, true, trx, blockedVehicleId);
			if (secondConnection == undefined) {
				message = 'Die Anfrage für die zweite Meile kann nicht erfüllt werden.';
				return;
			}
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
		if (p.connection1 != null) {
			request1Id =
				(await insertRequest(
					firstConnection!.best,
					p.capacities,
					p.connection1,
					customer,
					firstConnection!.eventGroupUpdateList,
					[...firstConnection!.mergeTourList],
					firstConnection!.pickupEventGroup,
					firstConnection!.dropoffEventGroup,
					firstConnection!.neighbourIds,
					firstConnection!.directDurations,
					kidsZeroToTwo,
					kidsThreeToFour,
					kidsFiveToSix,
					trx
				)) ?? null;
		}
		if (p.connection2 != null) {
			request2Id =
				(await insertRequest(
					secondConnection!.best,
					p.capacities,
					p.connection2,
					customer,
					secondConnection!.eventGroupUpdateList,
					[...secondConnection!.mergeTourList],
					secondConnection!.pickupEventGroup,
					secondConnection!.dropoffEventGroup,
					secondConnection!.neighbourIds,
					secondConnection!.directDurations,
					kidsZeroToTwo,
					kidsThreeToFour,
					kidsFiveToSix,
					trx
				)) ?? null;
		}
		message = 'Die Anfrage wurde erfolgreich bearbeitet.';
		success = true;
		return;
	});
	if (message == undefined) {
		return { status: 500 };
	}
	return { message, request1Id, request2Id, status: success ? 200 : 400 };
}
