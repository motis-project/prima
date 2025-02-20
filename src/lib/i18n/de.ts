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
		bookingSuccess: 'Buchung erfolgreich.',

		// Journey
		cancelled: 'Diese Fahrt wurde storniert.'
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

	atDateTime: (timeType, t: Date, isToday: boolean) =>
		`${timeType === 'departure' ? 'Los um ' : 'Ankunft um '} ` +
		t.toLocaleString('de', {
			hour: '2-digit',
			minute: '2-digit',
			weekday: isToday ? undefined : 'short',
			day: isToday ? undefined : '2-digit',
			month: isToday ? undefined : '2-digit',
			year: isToday ? undefined : '2-digit'
		}),

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
	odm: 'ÖPNV-Taxi - Buchung erforderlich!',
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
		'Das Fahrzeug muss wieder an der Abfahrtsstation abgestellt werden.',

	bookingInfo: 'Buchungsangaben',
	changeBookingInfo: 'Ändern Sie Ihre Such- und Buchungsangaben.',

	booking: {
		summary: 'Buchungszusammenfassung',
		header: 'Kostenpflichtig buchen',
		disclaimer:
			'Stornieren Sie die Fahrt mind. 24h vorher, falls sie die Fahrt nicht wahrnehmen können. Sollten Sie nicht rechtzeitig stornieren wird Ihnen die Taxi-Fahrt voll in Rechnung gestellt.',
		noLuggage: 'Kein Gepäck',
		handLuggage: 'Handgepäck',
		heavyLuggage: 'Schweres Gepäck',
		foldableWheelchair: 'Faltbarer Rollstuhl',
		withFoldableWheelchair: 'Mit faltbarem Rollstuhl',
		bookingFor: (passengers: number) => {
			switch (passengers) {
				case 1:
					return 'Buchung für eine Person';
				default:
					return `Buchung für ${passengers} Personen`;
			}
		},
		totalPrice: 'Gesamptpreis (Bezahlung im Taxi)',
		cancel: 'Stornieren',
		loginToBook: 'Einloggen zum Buchen',
		connection: 'Verbindung',
		ticket: 'Ticket',
		cancelTrip: 'Fahrt stornieren',
		cancelHeadline: 'Möchten Sie wirklich diese Fahrt stornieren?',
		noCancel: 'Nein, Fahrt nicht stornieren.',
		cancelDescription:
			'Die Stornierung der Fahrt kann nicht rückgängig gemacht werden. Eine Stornierung weniger als 24 Stunden vor der Fahrt ist mit Kosten verbunden.'
	}
};

export default translations;
