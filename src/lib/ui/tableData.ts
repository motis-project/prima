import { CAP, LOCALE } from '$lib/constants';
import type { TourWithRequests } from '$lib/util/getToursTypes';
import { getEuroString } from '$lib/util/odmPrice';
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
	overCap: number;
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
	toColumnStyle?: (r: T) => string;
	hidden?: boolean;
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

const getKidsCount = (tour: TourWithRequests, countOnlyVerified: boolean) => {
	let kids = 0;
	tour.requests.forEach((r) => {
		if (!countOnlyVerified || r.ticketChecked) {
			kids += r.kidsZeroToTwo + r.kidsThreeToFour + r.kidsFiveToSix;
		}
	});
	return kids;
};

const displayUnixtimeMs = (t: UnixtimeMs, displayTime?: boolean) => {
	return new Date(t).toLocaleDateString(LOCALE, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: displayTime ? '2-digit' : undefined,
		minute: displayTime ? '2-digit' : undefined
	});
};

const isPlanned = (tour: TourWithRequests) => {
	return (
		!tour.cancelled &&
		tour.fare === null &&
		!tour.requests.flatMap((request) => request.events).some((e) => e.ticketChecked) &&
		tour.endTime > Date.now()
	);
};

const getTourCost = (tour: TourWithRequests) => {
	return isPlanned(tour)
		? 0
		: (getCustomerCount(tour, true) === 0 ? 0 : (tour.fare ?? 0)) -
				tour.requests.reduce(
					(acc, current) => (current.ticketChecked ? current.ticketPrice : 0) + acc,
					0
				);
};

const displayDuration = (duration: number) => {
	const addLeadingZero = (n: number) => {
		return (n < 10 ? '0' : '') + n;
	};
	const hours = Math.floor(duration / HOUR);
	const minutes = ((duration / HOUR - hours) * MINUTE) / SECOND;
	return addLeadingZero(hours) + ':' + addLeadingZero(minutes) + 'h';
};

const getStatus = (r: TourWithRequests) => {
	return r.cancelled
		? r.message === null
			? 'vom Kunden storniert'
			: 'vom Unternehmen storniert'
		: r.fare === null
			? r.endTime < Date.now()
				? 'Taxameterstand nicht eingetragen'
				: 'geplant'
			: r.requests.flatMap((request) => request.events).some((e) => e.ticketChecked)
				? 'beendet'
				: 'beendet - Ticket nicht gescannt';
};

export const tourColsAdmin = [
	{
		text: ['Unternehmen'],
		sort: (a: TourWithRequests, b: TourWithRequests) => a.companyId - b.companyId,
		toTableEntry: (r: TourWithRequests) => r.companyName ?? ''
	},
	{
		text: ['Fahrzeug'],
		sort: (a: TourWithRequests, b: TourWithRequests) => a.vehicleId - b.vehicleId,
		toTableEntry: (r: TourWithRequests) => r.licensePlate ?? ''
	},
	{
		text: ['Von'],
		sort: undefined,
		toTableEntry: (r: TourWithRequests) => {
			const events = r.requests.flatMap((r) => r.events);
			events.sort((a, b) => a.scheduledTimeStart - b.scheduledTimeStart);
			return events[0].address;
		},
		hidden: true
	},
	{
		text: ['Nach'],
		sort: undefined,
		toTableEntry: (r: TourWithRequests) => {
			const events = r.requests.flatMap((r) => r.events);
			events.sort((a, b) => a.scheduledTimeStart - b.scheduledTimeStart);
			return events[events.length - 1].address;
		},
		hidden: true
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
		text: ['davon Kinder'],
		sort: (t1: TourWithRequests, t2: TourWithRequests) =>
			getKidsCount(t1, false) - getKidsCount(t2, false),
		toTableEntry: (r: TourWithRequests) => getKidsCount(r, false)
	},
	{
		text: ['erschienene', 'zahlende', 'Kunden'],
		sort: (t1: TourWithRequests, t2: TourWithRequests) =>
			getCustomerCount(t1, true) -
			getKidsCount(t1, true) -
			getCustomerCount(t2, true) +
			getKidsCount(t2, true),
		toTableEntry: (r: TourWithRequests) => getCustomerCount(r, true) - getKidsCount(r, true)
	},
	{
		text: ['Taxameterstand'],
		sort: (t1: TourWithRequests, t2: TourWithRequests) => (t1.fare ?? 0) - (t2.fare ?? 0),
		toTableEntry: (r: TourWithRequests) => getEuroString(r.fare)
	},
	{
		text: ['Ausgleichsleistung'],
		sort: (t1: TourWithRequests, t2: TourWithRequests) => getTourCost(t1) - getTourCost(t2),
		toTableEntry: (r: TourWithRequests) => (isPlanned(r) ? '-' : getEuroString(getTourCost(r)))
	},
	{
		text: ['Status'],
		sort: (t1: TourWithRequests, t2: TourWithRequests) => (getStatus(t1) < getStatus(t2) ? -1 : 1),
		toTableEntry: (r: TourWithRequests) => getStatus(r),
		toColumnStyle: (r: TourWithRequests) => {
			const status = getStatus(r);
			if (status.startsWith('beendet')) {
				return status === 'beendet' ? 'text-green-500' : 'text-red-500';
			}
			if (status.includes('storniert')) {
				return 'text-orange-400';
			}
			if (status === 'Taxameterstand nicht eingetragen') {
				return 'text-red-500';
			}
			return '';
		}
	}
];
export const tourColsCompany = tourColsAdmin.slice(1);

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
		text: ['Ausgleichsleistung', 'ohne Obergrenze'],
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
		sort: (a: Subtractions, b: Subtractions) => a.overCap - b.overCap,
		toTableEntry: (r: Subtractions) => getEuroString(r.overCap)
	},
	{
		text: ['Ausgleichsleistung', 'mit Obergrenze'],
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
		a.companyId === -1 ? 1 : b.companyId === -1 ? -1 : tiebreak(a, b);
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
		text: ['Ausgleichsleistung ohne', 'Obergrenze'],
		sort: summationLast((a: CompanyRow, b: CompanyRow) => a.uncapped - b.uncapped),
		toTableEntry: (r: CompanyRow) => getEuroString(r.uncapped)
	},
	{
		text: ['über', 'Obergrenze'],
		sort: (a: CompanyRow, b: CompanyRow) => a.overCap - b.overCap,
		toTableEntry: (r: CompanyRow) => getEuroString(r.overCap)
	},
	{
		text: ['Ausgleichsleistung mit', 'Obergrenze'],
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
