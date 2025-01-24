import type { Translations } from './translation';

const translations: Translations = {
	msg: {
		enterEmailAndPassword: 'Bitte gibt Deine E-Mail und Dein Passwort ein.',
		invalidEmail: 'Ungültige E-Mail Adresse.',
		emailAlreadyRegistered: 'Diese E-Mail Adresse ist bereits registriert.',
		weakPassword: 'Bitte wähle ein stärkeres Passwort.',
		tooManyRequests: 'Zu viele Anfragen.',
		failedToSendVerificationEmail: 'E-Mail zur Verifikation konnte nicht gesendet werden.',
	},
	account: {
		name: 'Name',
		email: 'E-Mail',
		password: 'Passwort',
		create: 'Nutzerkonto erstellen',
		login: 'Login',
	},
	journeyDetails: 'Verbindungsdetails',
	transfers: 'Umstiege',
	walk: 'Fußweg',
	bike: 'Fahrrad',
	cargoBike: 'Lastenfahrrad',
	scooterStanding: 'Stehroller',
	scooterSeated: 'Sitzroller',
	car: 'Auto',
	moped: 'Moped',
	from: 'Von',
	to: 'Nach',
	arrival: 'Ankunft',
	departure: 'Abfahrt',
	duration: 'Dauer',
	arrivals: 'Ankünfte',
	departures: 'Abfahrten',
	later: 'später',
	earlier: 'früher',
	track: 'Gleis',
	arrivalOnTrack: 'Ankunft auf Gleis',
	switchToArrivals: 'Wechsel zu Ankünften',
	switchToDepartures: 'Wechsel zu Abfahrten',
	tripIntermediateStops: (n: number) => {
		switch (n) {
			case 0:
				return 'Fahrt ohne Zwischenhalt';
			case 1:
				return 'Fahrt eine Station';
			default:
				return `Fahrt ${n} Stationen`;
		}
	},
	sharingProvider: 'Anbieter',
	roundtripStationReturnConstraint:
		'Das Fahrzeug muss wieder an der Abfahrtsstation abgestellt werden.'
};

export default translations;
