import { describe, it, expect } from 'vitest';
import { bookingApiQuery } from './routes/api/bookingRequest/queries';
import { Coordinates } from '$lib/location';
import { hoursToMs } from '$lib/time_utils';
import { Interval } from '$lib/interval';

const getTestParameters = () => {
	return {
		start: new Coordinates(51.506830990075144, 14.625787678141847),
		target: new Coordinates(51.50607958830929, 14.642887782399583),
		interval: new Interval(
			new Date(Date.now() + hoursToMs(48)),
			new Date(Date.now() + hoursToMs(72))
		),
		capacities: { bikes: 0, wheelchairs: 0, luggage: 0, passengers: 1 }
	};
};

describe('1start 1target same zones', async () => {
	const p = getTestParameters();
	const res = await bookingApiQuery(p.start, p.capacities, p.interval, [p.target]);
	const vehicles = res.companies[0].vehicles;
	it('zones match', () => {
		expect(res.companies.length).toBe(1);
		expect(res.companies[0].zoneId).toBe(2);
		expect(vehicles.length).toBe(1);
	});
	it('targetZones match', () => expect(res.targetZoneIds.get(0)).toStrictEqual([2]));
});

describe('1start 1target different zones', async () => {
	const p = getTestParameters();
	const inDifferentZoneThanStart = new Coordinates(51.179639396440706, 14.425225548739235);
	const res = await bookingApiQuery(p.start, p.capacities, p.interval, [inDifferentZoneThanStart]);
	it('zones match', () => {
		expect(res.companies.length).toBe(1);
		expect(res.companies[0].zoneId).toBe(2);
	});
	it('targetZones match', () => expect([...res.targetZoneIds.keys()].length).toBe(0));
});

describe('1start 1target same zone, too many passengers', async () => {
	const p = getTestParameters();
	const capacities = p.capacities;
	capacities.passengers = 4;
	const res = await bookingApiQuery(p.start, capacities, p.interval, [p.target]);
	it('zones match', () => expect(res.companies.length).toBe(0));
});

describe('1start 1target same zone, too many bikes', async () => {
	const p = getTestParameters();
	const capacities = p.capacities;
	capacities.bikes = 1;
	const res = await bookingApiQuery(p.start, capacities, p.interval, [p.target]);
	it('zones match', () => expect(res.companies.length).toBe(0));
});

describe('1start 1target same zone, too many wheelchairs', async () => {
	const p = getTestParameters();
	const capacities = p.capacities;
	capacities.wheelchairs = 1;
	const res = await bookingApiQuery(p.start, capacities, p.interval, [p.target]);
	it('zones match', () => expect(res.companies.length).toBe(0));
});

describe('1start 1target same zone, too much luggage', async () => {
	const p = getTestParameters();
	const capacities = p.capacities;
	capacities.luggage = 3;
	const res = await bookingApiQuery(p.start, capacities, p.interval, [p.target]);
	it('zones match', () => expect(res.companies.length).toBe(0));
});

describe('1start 1target same zone, luggage may be put on seats', async () => {
	const p = getTestParameters();
	const capacities = p.capacities;
	capacities.luggage = 2;
	const res = await bookingApiQuery(p.start, capacities, p.interval, [p.target]);
	it('zones match', () => expect(res.companies.length).toBe(1));
});

describe('1start 2targets', async () => {
	const p = getTestParameters();
	const inSameZoneAsStart = new Coordinates(51.505762013387766, 14.63155985748017);
	const res = await bookingApiQuery(p.start, p.capacities, p.interval, [
		inSameZoneAsStart,
		p.target
	]);
	it('zones match', () => {
		expect(res.companies.length).toBe(1);
		expect(res.companies[0].zoneId).toBe(2);
	});
	it('targetZones match', () => expect([...res.targetZoneIds.keys()].length).toBe(2));
});
