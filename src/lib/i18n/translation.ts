import { browser } from '$app/environment';
import en from './en';
import de from './de';

export type Translations = {
	account: {
		name: string;
		email: string;
		password: string;
		create: string;
		enterEmailAndPassword: string;
	};
	journeyDetails: string;
	transfers: string;
	walk: string;
	bike: string;
	cargoBike: string;
	scooterStanding: string;
	scooterSeated: string;
	car: string;
	moped: string;
	from: string;
	to: string;
	arrival: string;
	departure: string;
	duration: string;
	later: string;
	earlier: string;
	arrivals: string;
	departures: string;
	switchToArrivals: string;
	switchToDepartures: string;
	arrivalOnTrack: string;
	track: string;
	tripIntermediateStops: (n: number) => string;
	sharingProvider: string;
	roundtripStationReturnConstraint: string;
};

const translations: Map<string, Translations> = new Map(
	Object.entries({
		en,
		de
	})
);

export const language = (browser ? navigator.languages.find((l) => l.length == 2) : 'de') ?? 'de';
export const t = translations.get(language) ?? de;
