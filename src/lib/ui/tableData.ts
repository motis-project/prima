import { CAP, FIXED_PRICE } from '$lib/constants';
import type { TourWithRequests } from '$lib/server/db/getTours';
import { HOUR, MINUTE, SECOND } from '$lib/util/time';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export type CompanyRow = {
	taxameter: number;
	companyId: number;
	companyName?: string | null;
	capped: number;
	uncapped: number;
	availabilityDuration: number;
	customerCount: number;
	verifiedCustomerCount: number;
};

export type Subtractions = CompanyRow & {
	timestamp: UnixtimeMs;
	vehicleId: number;
	licensePlate: string;
};

export type Column<T> = {
	text: string[];
	sort: undefined | ((r1: T, r2: T) => number);
	toTableEntry: (r: T) => string | number;
};

export const getEuroString = (price: number | null) => {
	return ((price ?? 0) / 100).toFixed(2) + '€';
};

const getCustomerCount = (tour: TourWithRequests, countOnlyVerified: boolean) => {
	let customers = 0;
	tour.requests.forEach((r) => {
		if (!countOnlyVerified || r.ticketChecked) {
			customers += r.passengers;
		}
	});
	return customers;
};

const displayUnixtimeMs = (t: UnixtimeMs, displayTime?: boolean) => {
	return new Date(t).toLocaleDateString('de-DE', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: displayTime ? '2-digit' : undefined,
		minute: displayTime ? '2-digit' : undefined
	});
};

const getTourCost = (tour: TourWithRequests) => {
	return Math.max(0, (tour.fare ?? 0) - FIXED_PRICE * getCustomerCount(tour, true));
};

const displayDuration = (duration: number) => {
	const addLeadingZero = (n: number) => {
		return (n < 10 ? '0' : '') + n;
	};
	const hours = Math.floor(duration / HOUR);
	const minutes = ((duration / HOUR - hours) * MINUTE) / SECOND;
	return addLeadingZero(hours) + ':' + addLeadingZero(minutes) + 'h';
};

const firstTourColAdmin: Column<TourWithRequests> = {
	text: ['Unternehmen'],
	sort: (a: TourWithRequests, b: TourWithRequests) => a.companyId - b.companyId,
	toTableEntry: (r: TourWithRequests) => r.companyName ?? ''
};

const restTourCols = (isAdmin: boolean): Column<TourWithRequests>[] => {
	return [
		{
			text: ['Fahrzeug'],
			sort: (a: TourWithRequests, b: TourWithRequests) => a.vehicleId - b.vehicleId,
			toTableEntry: (r: TourWithRequests) => r.licensePlate ?? ''
		},
		{
			text: ['Abfahrt'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.startTime - t2.startTime,
			toTableEntry: (r: TourWithRequests) => displayUnixtimeMs(r.startTime, true)
		},
		{
			text: ['Ankunft'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) => t1.endTime - t2.endTime,
			toTableEntry: (r: TourWithRequests) => displayUnixtimeMs(r.endTime, true)
		},
		{
			text: ['Kunden'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) =>
				getCustomerCount(t1, false) - getCustomerCount(t2, false),
			toTableEntry: (r: TourWithRequests) => getCustomerCount(r, false)
		},
		{
			text: ['erschienene', 'Kunden'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) =>
				getCustomerCount(t1, true) - getCustomerCount(t2, true),
			toTableEntry: (r: TourWithRequests) => getCustomerCount(r, true)
		},
		{
			text: ['Taxameterstand'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) => (t1.fare ?? 0) - (t2.fare ?? 0),
			toTableEntry: (r: TourWithRequests) => getEuroString(r.fare)
		},
		{
			text: isAdmin ? ['Kosten'] : ['Einnahmen'],
			sort: (t1: TourWithRequests, t2: TourWithRequests) => getTourCost(t1) - getTourCost(t2),
			toTableEntry: (r: TourWithRequests) => getEuroString(getTourCost(r))
		}
	];
};

export const tourColsAdmin = [firstTourColAdmin].concat(restTourCols(true));
export const tourColsCompany = restTourCols(false);

export const subtractionColsAdmin: Column<Subtractions>[] = [
	{
		text: ['Unternehmen'],
		sort: (a: Subtractions, b: Subtractions) => a.companyId - b.companyId,
		toTableEntry: (r: Subtractions) => r.companyName ?? ''
	},
	{
		text: ['Fahrzeug'],
		sort: (a: Subtractions, b: Subtractions) => a.vehicleId - b.vehicleId,
		toTableEntry: (r: Subtractions) => r.licensePlate ?? ''
	},
	{
		text: ['Tag'],
		sort: (a: Subtractions, b: Subtractions) => a.timestamp - b.timestamp,
		toTableEntry: (r: Subtractions) => displayUnixtimeMs(r.timestamp)
	},
	{
		text: ['Kunden'],
		sort: (a: Subtractions, b: Subtractions) => a.customerCount - b.customerCount,
		toTableEntry: (r: Subtractions) => r.customerCount
	},
	{
		text: ['erschienene', 'Kunden'],
		sort: (a: Subtractions, b: Subtractions) => a.verifiedCustomerCount - b.verifiedCustomerCount,
		toTableEntry: (r: Subtractions) => r.verifiedCustomerCount
	},
	{
		text: ['Taxameterstand', 'kumuliert'],
		sort: (a: Subtractions, b: Subtractions) => a.taxameter - b.taxameter,
		toTableEntry: (r: Subtractions) => getEuroString(r.taxameter)
	},
	{
		text: ['Einnahmen', 'ohne Obergrenze'],
		sort: (a: Subtractions, b: Subtractions) => a.uncapped - b.uncapped,
		toTableEntry: (r: Subtractions) => getEuroString(r.uncapped)
	},
	{
		text: ['gesetzte', 'Verfügbarkeit'],
		sort: (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration,
		toTableEntry: (r: Subtractions) => displayDuration(r.availabilityDuration)
	},
	{
		text: ['Obergrenze'],
		sort: (a: Subtractions, b: Subtractions) => a.availabilityDuration - b.availabilityDuration,
		toTableEntry: (r: Subtractions) => getEuroString((r.availabilityDuration / HOUR) * CAP)
	},
	{
		text: ['über', 'Obergrenze'],
		sort: (a: Subtractions, b: Subtractions) =>
			a.uncapped -
			(a.availabilityDuration / HOUR) * CAP -
			(b.uncapped - (b.availabilityDuration / HOUR) * CAP),
		toTableEntry: (r: Subtractions) =>
			getEuroString(Math.max(r.uncapped - (r.availabilityDuration / HOUR) * CAP, 0))
	},
	{
		text: ['Einnahmen', 'mit Obergrenze'],
		sort: (a: Subtractions, b: Subtractions) => a.capped - b.capped,
		toTableEntry: (r: Subtractions) => getEuroString(r.capped)
	},
	{
		text: ['Abzüge'],
		sort: (a: Subtractions, b: Subtractions) => a.uncapped - a.capped - b.uncapped + b.capped,
		toTableEntry: (r: Subtractions) => getEuroString(r.uncapped - r.capped)
	}
];

export const subtractionColsCompany = subtractionColsAdmin.slice(1);
const summationLast = (tiebreak: (a: CompanyRow, b: CompanyRow) => number) => {
	return (a: CompanyRow, b: CompanyRow) =>
		a.companyName === 'Summiert' ? -1 : b.companyName === ' Summiert' ? 1 : tiebreak(a, b);
};
export const companyColsAdmin: Column<CompanyRow>[] = [
	{
		text: ['Unternehmen'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.companyId - b.companyId),
		toTableEntry: (r: CompanyRow) => r.companyName ?? ''
	},
	{
		text: ['Kunden'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.customerCount - b.customerCount),
		toTableEntry: (r: CompanyRow) => r.customerCount
	},
	{
		text: ['erschienene', 'Kunden'],
		sort: summationLast(
			(a: CompanyRow, b: CompanyRow) => a.verifiedCustomerCount - b.verifiedCustomerCount
		),
		toTableEntry: (r: CompanyRow) => r.verifiedCustomerCount
	},
	{
		text: ['Taxameterstand', 'kumuliert'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.taxameter - b.taxameter),
		toTableEntry: (r: CompanyRow) => getEuroString(r.taxameter)
	},
	{
		text: ['Kosten ohne', 'Obergrenze'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.uncapped - b.uncapped),
		toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped)
	},
	{
		text: ['Kosten mit Obergrenze'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.capped - b.capped),
		toTableEntry: (r: CompanyRow) => getEuroString(r.capped)
	},
	{
		text: ['Abzüge'],
		sort: summationLast(
			(a: CompanyRow, b: CompanyRow) => a.uncapped - a.capped - b.uncapped + b.capped
		),
		toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped - r.capped)
	}
];

export const companyColsCompany = companyColsAdmin.slice(1);
