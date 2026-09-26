import { createSession } from '$lib/server/auth/session';
import { Mode } from '$lib/server/booking/mode';
import type { ExpectedConnection } from '$lib/server/booking/expectedConnection';
import { signEntry } from '$lib/server/booking/signEntry';
import { bookingApi } from '$lib/server/booking/taxi/bookingApi';
import { inXMinutes, white } from '$lib/server/booking/testUtils';
import {
	addCompany,
	addTaxi,
	addTestUser,
	clearDatabase,
	getTours,
	setAvailability,
	Zone
} from '$lib/testHelpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MINUTE } from '$lib/util/time';
import { InsertWhat } from '$lib/util/booking/insertionTypes';

const capacities = {
	passengers: 1,
	wheelchairs: 0,
	bikes: 0,
	luggage: 0
};

const start = { lat: 51.29468377345111, lng: 14.833542206420248 };
const target = { lat: 51.29544187321241, lng: 14.820560314788537 };
const companyLocation = { lat: 51.294046423258095, lng: 14.820774891510126 };

const inWeisswasser1 = { lng: 14.643847884365528, lat: 51.507181621441845 };
const inKringelsdorf = { lng: 14.606555746634228, lat: 51.38851958039794 };
const inBoxberg = { lng: 14.577917469763548, lat: 51.40877145079591 };
const inNochten = { lng: 14.600164657165266, lat: 51.43191720040872 };
const inWeisswasser2 = { lng: 14.63490818370542, lat: 51.499039246023926 };

let mockUserId = -1;

beforeEach(async () => {
	await clearDatabase();
	mockUserId = (await addTestUser()).id;
	await createSession('generateSessionToken()', mockUserId);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('taxi offer expiration', () => {
	it('accepts a new-tour offer exactly at expiration but rejects it one minute later', async () => {
		const company = await addCompany(Zone.NIESKY, companyLocation);
		const taxi = await addTaxi(company, {
			passengers: 3,
			bikes: 0,
			wheelchairs: 0,
			luggage: 0
		});
		await setAvailability(taxi, inXMinutes(0), inXMinutes(300));

		const requestedTime = inXMinutes(70);
		const whitelistResponse = await white(
			JSON.stringify({
				start,
				target,
				startBusStops: [],
				targetBusStops: [],
				directTimes: [requestedTime],
				startFixed: true,
				capacities
			})
		).then((response) => response.json());

		const offer = whitelistResponse.direct[0];
		expect(offer).not.toBeNull();
		expect(typeof offer.timeOfferExpires).toBe('number');

		const createBookingParameters = () => {
			const connection1: ExpectedConnection = {
				start: { ...start, address: 'start address' },
				target: { ...target, address: 'target address' },
				startTime: offer.pickupTime,
				targetTime: offer.dropoffTime,
				signature: signEntry(
					start.lat,
					start.lng,
					target.lat,
					target.lng,
					offer.pickupTime,
					offer.dropoffTime,
					false,
					offer.timeOfferExpires
				),
				startFixed: true,
				requestedTime,
				mode: Mode.TAXI,
				timeOfferExpires: offer.timeOfferExpires
			};

			return { connection1, connection2: null, capacities };
		};

		const now = vi.spyOn(Date, 'now');
		now.mockReturnValue(offer.timeOfferExpires + MINUTE);
		const expiredResponse = await bookingApi(
			createBookingParameters(),
			mockUserId,
			false,
			false,
			0,
			0,
			0,
			0
		);
		expect(expiredResponse.status).not.toBe(200);
		expect(await getTours()).toHaveLength(0);

		now.mockReturnValue(offer.timeOfferExpires);
		const boundaryResponse = await bookingApi(
			createBookingParameters(),
			mockUserId,
			false,
			false,
			0,
			0,
			0,
			0
		);
		expect(boundaryResponse.status).toBe(200);
		expect(await getTours()).toHaveLength(1);
	}, 60_000);
	it('accepts a pair-insertion offer exactly at expiration but rejects it one minute later', async () => {
		const company = await addCompany(Zone.WEIßWASSER, inWeisswasser1);
		const taxi = await addTaxi(company, {
			passengers: 3,
			bikes: 0,
			wheelchairs: 0,
			luggage: 0
		});
		await setAvailability(taxi, inXMinutes(0), inXMinutes(600));

		const initialRequestedTime = inXMinutes(70);
		const initialWhitelistResponse = await white(
			JSON.stringify({
				start: inWeisswasser2,
				target: inBoxberg,
				startBusStops: [],
				targetBusStops: [],
				directTimes: [initialRequestedTime],
				startFixed: false,
				capacities
			})
		).then((response) => response.json());
		const initialOffer = initialWhitelistResponse.direct[0];
		expect(initialOffer).not.toBeNull();

		const initialConnection: ExpectedConnection = {
			start: { ...inWeisswasser2, address: 'weisswasser' },
			target: { ...inBoxberg, address: 'boxberg' },
			startTime: initialOffer.pickupTime,
			targetTime: initialOffer.dropoffTime,
			signature: signEntry(
				inWeisswasser2.lat,
				inWeisswasser2.lng,
				inBoxberg.lat,
				inBoxberg.lng,
				initialOffer.pickupTime,
				initialOffer.dropoffTime,
				false
			),
			startFixed: false,
			requestedTime: initialRequestedTime,
			mode: Mode.TAXI
		};
		const initialBookingResponse = await bookingApi(
			{ connection1: initialConnection, connection2: null, capacities },
			mockUserId,
			false,
			false,
			0,
			0,
			0,
			0
		);
		expect(initialBookingResponse.status).toBe(200);
		expect(await getTours()).toHaveLength(1);

		const pairRequestedTime = inXMinutes(90);
		const pairWhitelistResponse = await white(
			JSON.stringify({
				start: inNochten,
				target: inKringelsdorf,
				startBusStops: [],
				targetBusStops: [],
				directTimes: [pairRequestedTime],
				startFixed: false,
				capacities
			})
		).then((response) => response.json());
		const pairOffer = pairWhitelistResponse.direct[0];
		expect(pairOffer).not.toBeNull();
		expect(typeof pairOffer.timeOfferExpires).toBe('number');
		expect(pairOffer.pickupCase.what).not.toBe(InsertWhat.BOTH);
		expect(pairOffer.dropoffCase.what).not.toBe(InsertWhat.BOTH);

		const createPairBookingParameters = () => {
			const connection1: ExpectedConnection = {
				start: { ...inNochten, address: 'nochten' },
				target: { ...inKringelsdorf, address: 'kringelsdorf' },
				startTime: pairOffer.pickupTime,
				targetTime: pairOffer.dropoffTime,
				signature: signEntry(
					inNochten.lat,
					inNochten.lng,
					inKringelsdorf.lat,
					inKringelsdorf.lng,
					pairOffer.pickupTime,
					pairOffer.dropoffTime,
					false
				),
				startFixed: false,
				requestedTime: pairRequestedTime,
				mode: Mode.TAXI
			};

			return { connection1, connection2: null, capacities };
		};

		const now = vi.spyOn(Date, 'now');
		now.mockReturnValue(pairOffer.timeOfferExpires + MINUTE);
		const expiredResponse = await bookingApi(
			createPairBookingParameters(),
			mockUserId,
			false,
			false,
			0,
			0,
			0,
			0
		);
		expect(expiredResponse.status).not.toBe(200);
		let tours = await getTours();
		expect(tours).toHaveLength(1);
		expect(tours[0].requests).toHaveLength(1);

		now.mockReturnValue(pairOffer.timeOfferExpires);
		const boundaryResponse = await bookingApi(
			createPairBookingParameters(),
			mockUserId,
			false,
			false,
			0,
			0,
			0,
			0
		);
		expect(boundaryResponse.status).toBe(200);
		tours = await getTours();
		expect(tours).toHaveLength(1);
		expect(tours[0].requests).toHaveLength(2);
	}, 60_000);
});
