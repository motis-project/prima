import type { CheckBookingValidityParameters } from '$lib/bookingApiParameters';
import { Coordinates } from '$lib/location';
import { describe, it, expect, beforeEach } from 'vitest';
import { getViableBusStops } from './viableBusStops';
import type { Capacities } from '$lib/capacities';
import { minutesToMs, MsToHours } from '$lib/time_utils';
import {
	addCompany,
	addTaxi,
	clearDatabase,
	setAvailability,
	setTour,
	Zone
} from '$lib/testHelpers';
import {
	MAX_PASSENGER_WAITING_TIME_DROPOFF,
	MAX_PASSENGER_WAITING_TIME_PICKUP,
	VOLUME_CAP
} from '$lib/constants';

const inNiesky = new Coordinates(51.292260904642916, 14.822263713757678);
const inZittau = new Coordinates(50.89857713197384, 14.8098212004343);

const BASE_DATE_MS = new Date('2050-09-23T17:00').getTime();
const dateInXMinutes = (x: number): Date => {
	return new Date(BASE_DATE_MS + minutesToMs(x));
};
const dateInXMinutesYMs = (x: number, y: number): Date => {
	return new Date(BASE_DATE_MS + minutesToMs(x) + y);
};

describe('blacklisting test', () => {
	beforeEach(async () => {
		await clearDatabase();
	});

	it('blacklisting success', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(90));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting success with availability', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting success with tour', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(90));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting success, 2 busstops with 2 times each', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{ times: [dateInXMinutes(50), dateInXMinutes(10)], coordinates: inNiesky },
				{ times: [dateInXMinutes(150), dateInXMinutes(200)], coordinates: inNiesky }
			],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(4);
	});

	it('blacklisting success, luggage on seats', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 2 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting fail, wrong busStop Zone', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inZittau }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, wrong user chosen Zone', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inZittau,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, too many passengers', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 4, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, too many bikes', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 4, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, too many wheelchairs', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 4, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, too much luggage', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 7 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, no vehicle', async () => {
		await addCompany(Zone.NIESKY);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, no company', async () => {
		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting fail, no availability or tour', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		await addTaxi(company, capacities);
		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting, 1 busStop fails, other is succesful', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{ times: [dateInXMinutes(50)], coordinates: inZittau },
				{ times: [dateInXMinutes(50)], coordinates: inNiesky }
			],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
		expect(res[0].busstopindex).toBe(1);
		expect(res[0].timeIndex).toBe(0);
	});

	it('blacklisting, 1 busStopTime fails, other is succesful', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [dateInXMinutes(1000), dateInXMinutes(50)], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
		expect(res[0].busstopindex).toBe(0);
		expect(res[0].timeIndex).toBe(1);
	});

	it('blacklisting, no busStops', async () => {
		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting, 1 busStop has not times and fails, other is succesful', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));
		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{ times: [], coordinates: inNiesky },
				{ times: [dateInXMinutes(50)], coordinates: inNiesky }
			],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
		expect(res[0].busstopindex).toBe(1);
		expect(res[0].timeIndex).toBe(0);
	});

	it('blacklisting, no times', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 3, wheelchairs: 3, luggage: 3 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);
		await setTour(taxi, dateInXMinutes(0), dateInXMinutes(900));
		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [{ times: [], coordinates: inNiesky }],
			startFixed: true,
			capacities: { passengers: 0, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting success, availability barely overlaps (startfixed=false)', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{
					times: [dateInXMinutesYMs(90, MAX_PASSENGER_WAITING_TIME_DROPOFF)],
					coordinates: inNiesky
				}
			],
			startFixed: false,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting success, availability barely does not overlap (startfixed=false)', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{
					times: [dateInXMinutesYMs(91, MAX_PASSENGER_WAITING_TIME_DROPOFF)],
					coordinates: inNiesky
				}
			],
			startFixed: false,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});

	it('blacklisting success, availability barely overlaps (startfixed=true)', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{ times: [dateInXMinutesYMs(0, -MAX_PASSENGER_WAITING_TIME_PICKUP)], coordinates: inNiesky }
			],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(1);
	});

	it('blacklisting success, availability barely does not overlap (startfixed=true)', async () => {
		const capacities: Capacities = { passengers: 3, bikes: 0, wheelchairs: 0, luggage: 0 };
		const company = await addCompany(Zone.NIESKY);
		const taxi = await addTaxi(company, capacities);

		await setAvailability(taxi, dateInXMinutes(0), dateInXMinutes(90), 0);

		const r: CheckBookingValidityParameters = {
			userChosen: inNiesky,
			busStops: [
				{
					times: [dateInXMinutesYMs(-1, -MAX_PASSENGER_WAITING_TIME_PICKUP)],
					coordinates: inNiesky
				}
			],
			startFixed: true,
			capacities: { passengers: 1, bikes: 0, wheelchairs: 0, luggage: 0 }
		};
		const res = await getViableBusStops(r.userChosen, r.busStops, r.startFixed, r.capacities);
		expect(res).toHaveLength(0);
	});
});
