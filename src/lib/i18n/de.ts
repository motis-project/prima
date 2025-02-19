import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Verbindungen',
		bookings: 'Buchungen',
		account: 'Konto',
		availability: 'Verfügbarkeit',
		company: 'Unternehmen',
		completedTours: 'Fahrten',
		employees: 'Mitarbeiter',
		companies: 'Unternehmen'
	},
	msg: {
		unkownError: 'Unbekannter Fehler.',

		// Account
		enterEmailAndPassword: 'Bitte gib Deine E-Mail und Dein Passwort ein.',
		invalidEmail: 'Ungültige E-Mail Adresse.',
		emailAlreadyRegistered: 'Diese E-Mail Adresse ist bereits registriert.',
		weakPassword: 'Bitte wähle ein stärkeres Passwort.',
		tooManyRequests: 'Zu viele Anfragen.',
		failedToSendVerificationEmail: 'E-Mail zur Verifikation konnte nicht gesendet werden.',
		accountDoesNotExist: 'Nutzerkonto existiert nicht.',
		invalidPassword: 'Ungültiges Passwort.',
		new: 'Neu hier? <a href="/account/signup" class="link">Erstelle ein neues Nutzerkonto!</a>',
		enterYourCode: 'Bitte gib den Code ein.',
		codeExpiredSentAnother: 'Dieser Code ist abgelaufen. Wir haben Dir einen neuen Code geschickt.',
		incorrectCode: 'Falscher Code.',
		newCodeSent: 'Wir haben einen neuen Code an Deine E-Mail Adresse geschickt.',
		enterNewPassword: 'Bitte gib Dein neues Passwort ein.',
		passwordChanged: 'Passwort erfolgreich geändert.',
		enterEmail: 'Gib deine E-Mail Adresse ein.',
		oldEmail: 'Dies ist die bereits verwendete E-Mail Adresse.',
		checkInboxToVerify:
			'Bitte prüfe Dein E-Mail Postfach um Deine neue E-Mail Adresse zu verifizieren.',
		passwordResetSuccess:
			'Passwort erfolgreich zurückgesetzt. Du kannst Dich jetzt mit dem neuen Passwort anmelden.',

		// Admin
		userDoesNotExist: 'Nutzer existiert nicht.',
		activationSuccess: 'Nutzer freigeschaltet.',
		userAlreadyActivated: 'Nutzer war bereits freigeschaltet.',

		// Taxi Members
		driverAddedSuccessfully: 'Fahrer erfolgreich hinzugefügt.',
		ownerAddedSucessfully: 'Verwaltungsnutzer erfolgreich hinzugefügt.',

		// Company
		nameTooShort: 'Name zu kurz.',
		addressTooShort: 'Adresse zu kurz.',
		zoneNotSet: 'Pflichtfahrgebiet nicht gesetzt.',
		addressNotInZone: 'Die Adresse liegt nicht im Pflichtfahrgebiet.',
		companyUpdateSuccessful: 'Unternehmensdaten erfolgreich aktualisiert.',

		// AddVehicle
		invalidSeats: 'Ungültige Sitzzahl,',
		invalidLicensePlate: 'Ungültiges Kennzeichen.',
		invalidStorage: 'Ungültiger Stauraum.',
		duplicateLicensePlate: 'Kennzeichen existiert bereits.',
		vehicleAddedSuccessfully: 'Fahrzeug erfolgreich angelegt.',

		//Request
		requestCancelled: 'Fahrt storniert',

		// Booking
		noRouteFound: 'Keine Route gefunden.',
		distanceTooLong: 'Distanz zu lang.',
		startDestTooClose: 'Distanz zu kurz.',
		maxTravelTimeExceeded: 'Fahrstrecke zu lang.',
		minPrepTime: 'Vorlaufzeit unterschritten.',
		startDestNotInSameZone: 'Start und Ziel nicht im selben Pflichtfahrgebiet.',
		noVehicle: 'Kein Fahrzeug verfügbar.',
		routingRequestFailed: 'Routinganfrage fehlgeschlagen.',

		// Booking
		bookingError: 'Die Fahrt konnte nicht gebucht werden.',
		bookingError1: 'Erster Abschnitt konnte nicht gebucht werden.',
		bookingError2: 'Zweiter Abschnitt konnte nicht gebucht werden.',
		bookingSuccess: 'Buchung erfolgreich.'
	},
	admin: {
		completedToursSubtitle: 'Abgeschlossene Fahrten',
		activateTaxiOwners: 'Taxiunternehmer freischalten'
	},
	account: {
		name: 'Name',
		email: 'E-Mail',
		password: 'Passwort',
		create: 'Nutzerkonto erstellen',
		login: 'Login',
		sentAnEmailTo: 'Wir haben Dir einen Code an folgende E-Mail Adresse geschickt:',
		changeYourEmail:
			'Die E-Mail Adresse kann in den <a href="/account/settings">Kontoeinstellungen</a> geändert werden',
		emailVerification: 'E-Mail Verifikation',
		verifySubtitle: 'Verifiziere Deine E-Mail Adresse mit dem Code, den wir Dir geschickt haben.',
		resetPassword: 'Passwort zurücksetzen',
		resetPasswordSubtitle: 'Passwort ändern',
		changeEmail: 'E-Mail Adresse ändern',
		changeEmailSubtitle:
			'Ändere Deine E-Mail Adresse. Wir werden Dir einen neuen Code zur Verifizierung senden.',
		logout: 'Abmelden',
		logoutSubtitle: 'Aus dem Konto abmelden. Du kannst Dich jederzeit wieder anmelden.',
		code: 'Code',
		passwordReset: 'Passwort zurücksetzen',
		passwordResetSubtitle: 'Hier kannst Du ein neues Passwort festlegen.',
		passwordResetRequest: 'Passwort zurücksetzen',
		passwordResetRequestSubtitle: 'Wir schicken Dir einen Code an Deine E-Mail Adresse.',
		newPassword: 'Neues Passwort',
		resendCode: 'Code erneut senden',
		verify: 'Verifizieren'
	},
	journeyDetails: 'Verbindungsdetails',
	transfers: 'Umstiege',
	walk: 'Fußweg',
	bike: 'Fahrrad',
	cargoBike: 'Lastenfahrrad',
	scooterStanding: 'Stehroller',
	scooterSeated: 'Sitzroller',
	car: 'Auto',
	taxi: 'Taxi',
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
