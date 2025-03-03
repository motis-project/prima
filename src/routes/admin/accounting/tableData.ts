import { FIXED_PRICE } from '$lib/constants';
import type { TourWithRequests } from '$lib/server/db/getTours';
import { HOUR, MINUTE, SECOND } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type CompanyRow = {
	taxameter: number;
	companyId: number;
	companyName: string | null;
	capped: number;
	uncapped: number;
	availabilityDuration: number;
	customerCount: number;
};

export type Subtractions = CompanyRow & { timestamp: UnixtimeMs };

export type Column<T> = {
	text: string;
	sort: undefined | ((r1: T, r2: T) => number);
	toTableEntry: (r: T) => string | number;
};

export const getEuroString = (price: number | null) => {
	return ((price ?? 0) / 100).toFixed(2) + '€';
};

const getCustomerCount = (tour: TourWithRequests) => {
	let customers = 0;
	tour.requests.forEach((r) => {
		customers += r.passengers;
	});
	return customers;
};

const getTourCost = (tour: TourWithRequests) => {
	return Math.max(0, (tour.fare ?? 0) - FIXED_PRICE * getCustomerCount(tour));
};

const displayDuration = (duration: number) => {
	const rounded = Math.floor(duration / HOUR);
	const minutes = ((duration / HOUR - rounded) * MINUTE) / SECOND;
	return (rounded < 10 ? '0' : '') + rounded + ':' + (minutes < 10 ? '0' : '') + minutes;
};

export const tourCols: Column<TourWithRequests>[] = [
	{
		text: 'Unternehmen',
		sort: undefined,
		toTableEntry: (r: TourWithRequests) => r.companyName ?? ''
	},
	{
		text: 'Abfahrt  ',
		sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.startTime - t2.startTime,
		toTableEntry: (r: TourWithRequests) =>
			new Date(r.startTime).toLocaleString('de-DE').slice(0, -3)
	},
	{
		text: 'Ankunft',
		sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.endTime - t2.endTime,
		toTableEntry: (r: TourWithRequests) => new Date(r.endTime).toLocaleString('de-DE').slice(0, -3)
	},
	{
		text: 'Anzahl Kunden',
		sort: undefined,
		toTableEntry: (r: TourWithRequests) => getCustomerCount(r)
	},
	{
		text: 'Taxameterstand  ',
		sort: (t1: TourWithRequests, t2: TourWithRequests) => (t1.fare ?? 0) - (t2.fare ?? 0),
		toTableEntry: (r: TourWithRequests) => getEuroString(r.fare)
	},
	{
		text: 'Kosten  ',
		sort: (t1: TourWithRequests, t2: TourWithRequests) => getTourCost(t1) - getTourCost(t2),
		toTableEntry: (r: TourWithRequests) => getEuroString(getTourCost(r))
	}
];

export const subtractionCols: Column<Subtractions>[] = [
	{
		text: 'Unternehmen',
		sort: undefined,
		toTableEntry: (r: Subtractions) => r.companyName ?? ''
	},
	{
		text: 'Tag  ',
		sort: (a: Subtractions, b: Subtractions) => a.timestamp - b.timestamp,
		toTableEntry: (r: Subtractions) => new Date(r.timestamp).toLocaleDateString('de-DE')
	},
	{ text: 'Buchungen', sort: undefined, toTableEntry: (r: Subtractions) => r.customerCount },
	{
		text: 'Taxameterstand kumuliert ',
		sort: (a: Subtractions, b: Subtractions) => a.taxameter - b.taxameter,
		toTableEntry: (r: Subtractions) => getEuroString(r.taxameter)
	},
	{
		text: 'Kosten ohne Obergrenze  ',
		sort: (a: Subtractions, b: Subtractions) => a.uncapped - b.uncapped,
		toTableEntry: (r: Subtractions) => getEuroString(r.uncapped)
	},
	{
		text: 'Kosten mit Obergrenze  ',
		sort: (a: Subtractions, b: Subtractions) => a.capped - b.capped,
		toTableEntry: (r: Subtractions) => getEuroString(r.capped)
	},
	{
		text: 'Abzüge  ',
		sort: (a: Subtractions, b: Subtractions) => a.uncapped - a.capped - b.uncapped + b.capped,
		toTableEntry: (r: Subtractions) => getEuroString(r.uncapped - r.capped)
	},
	{
		text: 'gesetzte Verfügbarkeit',
		sort: (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration,
		toTableEntry: (r: Subtractions) => displayDuration(r.availabilityDuration)
	}
];

export const companyCols: Column<CompanyRow>[] = [
	{
		text: 'Unternehmen',
		sort: undefined,
		toTableEntry: (r: CompanyRow) => r.companyName ?? ''
	},
	{ text: 'Buchungen', sort: undefined, toTableEntry: (r: CompanyRow) => r.customerCount },
	{
		text: 'Taxameterstand kumuliert ',
		sort: (a: CompanyRow, b: CompanyRow) => a.taxameter - b.taxameter,
		toTableEntry: (r: CompanyRow) => getEuroString(r.taxameter)
	},
	{
		text: 'Kosten ohne Obergrenze  ',
		sort: (a: CompanyRow, b: CompanyRow) => a.uncapped - b.uncapped,
		toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped)
	},
	{
		text: 'Kosten mit Obergrenze  ',
		sort: (a: CompanyRow, b: CompanyRow) => a.capped - b.capped,
		toTableEntry: (r: CompanyRow) => getEuroString(r.capped)
	},
	{
		text: 'Abzüge  ',
		sort: (a: CompanyRow, b: CompanyRow) => a.uncapped - a.capped - b.uncapped + b.capped,
		toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped - r.capped)
	},
	{
		text: 'gesetzte Verfügbarkeit',
		sort: (a: CompanyRow, b: CompanyRow) => a.availabilityDuration - b.availabilityDuration,
		toTableEntry: (r: CompanyRow) => displayDuration(r.availabilityDuration)
	}
];
