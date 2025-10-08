import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Verbindungen',
		bookings: 'Meine Fahrten',
		account: 'Konto',
		availability: 'Verfügbarkeit',
		company: 'Unternehmen',
		completedTours: 'Fahrten',
		accounting: 'Abrechnung',
		employees: 'Mitarbeiter',
		companies: 'Unternehmen'
	},
	msg: {
		unknownError: 'Unbekannter Fehler.',

		// Account
		enterEmailAndPassword: 'Bitte geben Sie Ihre E-Mail und Ihr Passwort ein.',
		invalidEmail: 'Ungültige E-Mail-Adresse.',
		invalidPhone: 'Ungültige Telefonnummer.',
		invalidZipCity: 'Ungültige PLZ/Ort/Region.',
		emailAlreadyRegistered: 'Diese E-Mail-Adresse ist bereits registriert.',
		weakPassword: 'Bitte wählen Sie ein stärkeres Passwort.',
		tooManyRequests: 'Zu viele Anfragen.',
		failedToSendVerificationEmail: 'E-Mail zur Verifikation konnte nicht gesendet werden.',
		failedToSendPasswordResetEmail:
			'E-Mail zum Zurücksetzen des Passworts konnte nicht gesendet werden.',
		accountDoesNotExist: 'Nutzerkonto existiert nicht.',
		invalidPassword: 'Ungültiges Passwort.',
		invalidOldPassword: 'Das alte Passwort ist ungültig.',
		new: 'Neu hier? <a href="/account/signup" class="link">Erstellen Sie ein neues Nutzerkonto!</a>',
		enterYourCode: 'Bitte geben Sie den Code ein.',
		codeExpiredSentAnother:
			'Dieser Code ist abgelaufen. Wir haben Ihnen einen neuen Code geschickt.',
		incorrectCode: 'Falscher oder abgelaufener Code.',
		newCodeSent: 'Wir haben einen neuen Code an Ihre E-Mail-Adresse geschickt.',
		enterNewPassword: 'Bitte geben Sie Ihr neues Passwort ein.',
		enterOldPassword: 'Bitte geben Sie Ihr altes Passwort ein.',
		passwordChanged: 'Passwort erfolgreich geändert.',
		phoneChanged: 'Telefonnummer erfolgreich geändert.',
		enterEmail: 'Geben Sie Ihre E-Mail-Adresse ein.',
		oldEmail: 'Dies ist die bereits verwendete E-Mail-Adresse.',
		checkInboxToVerify:
			'Bitte prüfen Sie Ihr E-Mail-Postfach um Ihre neue E-Mail-Adresse zu verifizieren.',
		passwordResetSuccess:
			'Passwort erfolgreich zurückgesetzt. Sie können sich jetzt mit dem neuen Passwort anmelden.',

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
		invalidSeats: 'Ungültige Sitzzahl.',
		invalidLicensePlate: 'Ungültiges Kennzeichen.',
		invalidStorage: 'Ungültiger Stauraum.',
		insufficientCapacities:
			'Eine auf diesem Fahrzeug geplante Tour ist mit den neuen Kapazitätsangaben nicht durchführbar.',
		duplicateLicensePlate: 'Kennzeichen existiert bereits.',
		vehicleAddedSuccessfully: 'Fahrzeug erfolgreich angelegt.',
		vehicleAlteredSuccessfully: ' Fahrzeug erfolgreich geändert',

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
		vehicleConflict: 'Das gewählte Fahrzeug ist zum gewählten Zeitpunkt nicht verfügbar.',

		// Booking
		bookingError: 'Die Fahrt konnte nicht gebucht werden.',
		bookingError1: 'Erster Abschnitt konnte nicht gebucht werden.',
		bookingError2: 'Zweiter Abschnitt konnte nicht gebucht werden.',
		bookingSuccess: 'Buchung erfolgreich.',

		// Journey
		cancelled: 'Diese Fahrt wurde storniert.',
		stillNegotiating: 'Die Mitfahrgelegenheit ist noch nicht fest vereinbart.',
		openRequest: 'Dieses Mitfahrangebot hat offene Anfragen.',

		// Feedback
		feedbackThank: 'Vielen Dank für Ihr Feedback!',
		feedbackMissing: 'Kein Feedback gegeben',

		// Picture Upload
		noFileUploaded: 'kein Bild hochgeladen',
		invalidFileType: 'ungültiger Dateityp',
		fileTooLarge: 'Datei ist zu groß'
	},
	admin: {
		completedToursSubtitle: 'Abgeschlossene Fahrten',
		activateTaxiOwners: 'Taxiunternehmer freischalten'
	},
	account: {
		name: 'Name',
		lastName: 'Nachname',
		firstName: 'Vorname',
		gender: (id: string) => {
			return { o: 'n/a', f: 'Frau', m: 'Herr', n: 'keine Angabe' }[id]!;
		},
		genderString: 'Geschlecht',
		email: 'E-Mail',
		password: 'Passwort',
		phone: 'Telefonnummer',
		zipCode: 'PLZ',
		city: 'Ort',
		region: 'Region',
		create: 'Nutzerkonto erstellen',
		forgotPassword: 'Passwort vergessen?',
		signupConditions: (tos: string, privacy: string, provider: string) =>
			`Durch die Anmeldung stimme ich den ${tos} sowie der ${privacy} von ${provider} zu.`,
		tos: 'Beförderungsbedingungen',
		imprint: 'Impressum',
		dataLicenses: 'Fahrplandatenquellen',
		privacyShort: 'Datenschutz',
		privacy: 'Datenschutzerklärung',
		login: 'Login',
		sentAnEmailTo: 'Wir haben Ihnen einen Code an folgende E-Mail-Adresse geschickt:',
		changeYourEmail:
			'Die E-Mail-Adresse kann in den <a href="/account/settings">Kontoeinstellungen</a> geändert werden',
		emailVerification: 'E-Mail Verifikation',
		verifySubtitle:
			'Verifizieren Sie Ihre E-Mail-Adresse mit dem Code, den wir Ihnen geschickt haben.',
		resetPassword: 'Passwort zurücksetzen',
		resetPasswordSubtitle: 'Passwort ändern',
		changeEmail: 'E-Mail-Adresse ändern',
		changePhone: 'Telefonnummer ändern',
		changeEmailSubtitle:
			'Ändern Sie Ihre E-Mail-Adresse. Wir werden Ihnen einen neuen Code zur Verifizierung senden.',
		changePhoneSubtitle: 'Ändern Sie Ihre Telefonnummer.',
		logout: 'Abmelden',
		logoutSubtitle: 'Aus dem Konto abmelden. Sie können sich jederzeit wieder anmelden.',
		code: 'Code',
		passwordReset: 'Passwort zurücksetzen',
		passwordResetSubtitle: 'Hier können Sie ein neues Passwort festlegen.',
		passwordResetRequest: 'Passwort zurücksetzen',
		passwordResetRequestSubtitle: 'Wir schicken Ihnen einen Code an Ihre E-Mail-Adresse.',
		newPassword: 'Neues Passwort',
		oldPassword: 'Altes Passwort',
		resendCode: 'Code erneut senden',
		verify: 'Verifizieren',
		profilePicture: 'Profilbild',
		profilePictureSubtitle: 'Hier können Sie Ihr Profilbild ändern',
		personalInfo: 'Personenbezogene Informationen',
		adjustPersonalInfo: 'Ändern Sie Ihre persönlichen Informationen'
	},
	rating: {
		thanksForUsing: 'Vielen Dank, dass Sie das ÖPNV Taxi benutzt haben.',
		howHasItBeen: 'Wie war es?',
		giveFeedback: 'Geben Sie uns Ihr Feedback.',
		reason: 'Anlass der Fahrt',
		tourism: 'Tourismus',
		commute: 'Beschäftigung/Pendeln',
		education: 'Bildung (Schule/Hochschule)',
		errands: 'Erledigungen',
		leisure: 'Freizeit',
		howHasBookingBeen: 'Waren Sie mit dem Buchungsprozess zufrieden?',
		howHasJourneyBeen: 'Waren Sie mit der Fahrt zufrieden?',
		yourFeedback: 'Ihr Feedback',
		good: 'ja',
		bad: 'nein',
		sendFeedback: 'Feedback abschicken'
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

	bookingsHeader: 'Meine gebuchten und gespeicherten Fahrten',
	cancelledJourneys: 'Vergangene und stornierte Fahrten',
	noBookings: 'Sie haben bisher keine gebuchten oder gespeicherten Fahrten.',
	journeyDetails: 'Verbindungsdetails',
	transfer: 'Umstieg',
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
	rideSharing: 'Mitfahrangebot',
	rideSharingBookingRequired: 'Mitfahrangebot - Vereinbarung erforderlich!',
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
	meetingPointNavigation: 'Navigation zum Treffpunkt',
	noItinerariesFound: 'Keine Verbindungen gefunden.',

	bookingInfo: 'Buchungsangaben',
	changeBookingInfo: 'Ändern Sie Ihre Such- und Buchungsangaben.',
	storeItinerary: 'Reisekette speichern',
	removeItinerary: 'Reisekette entfernen',
	introduction:
		'Ziel des Projekts <a href="https://www.primaplusoev.de/" class="link" target="_blank">PriMa+ÖV</a> ist es, den ÖPNV durch Ruftaxis und in Zukunft auch Mitfahrgelegenheiten zu ergänzen, um ein mindestens zweistündliches Fahrtangebot auch in ländlichen Regionen und zu Tagesrandzeiten zu gewährleisten. Mehr über <a href="https://www.primaplusoev.de/" class="link" target="_blank">PriMa+ÖV</a>',
	publicTransitTaxi: 'ÖPNV-Taxi',
	serviceArea: 'Bediengebiet',
	serviceTime: 'Bedienzeit',
	serviceTimeContent: 'i.d.R. 05:00 - 22:00 Uhr (abhängig von Taxiverfügbarkeit)',
	regionAround: 'Region um',
	perPerson: 'pro Person',
	perRide: 'pro Fahrt',
	fare: 'Fahrpreis',
	bookingDeadline: 'Buchungsschluss',
	bookingDeadlineContent:
		'min. 1 Stunde im Voraus, bei Buchungen für das Wochenende bis Freitag 18 Uhr',
	logo: 'Das PriMa+ÖV Logo. Ikonographische Darstellung eines Autos, Busses, Zuges und Taxis.',
	toConnectionSearch: 'Zur Verbindungssuche',

	booking: {
		bookHere: 'Hier buchen. Preis',
		summary: 'Zusammenfassung',
		header: 'Kostenpflichtig buchen',
		disclaimer:
			'Stornieren Sie die Fahrt mind. eine Stunde vorher, falls Sie die Fahrt nicht wahrnehmen können. Sollten Sie nicht rechtzeitig stornieren, wird Ihnen die Anfahrt des Taxis voll in Rechnung gestellt.',
		noLuggage: 'Kein Gepäck',
		handLuggage: 'Handgepäck',
		heavyLuggage: 'Schweres Gepäck',
		kidsDescription:
			'Bitte geben Sie an wie viele dieser Passagiere in die folgenden Altersgruppen fallen:',
		kidsZeroToTwo: '0 - 2 Jahre',
		kidsThreeToFour: '3 - 4 Jahre',
		kidsFiveToSix: '5 - 6 Jahre',
		foldableWheelchair: 'Faltbarer Rollstuhl',
		withFoldableWheelchair: 'Mit faltbarem Rollstuhl',
		passengerNumber: 'Anzahl Personen',
		bookingFor: (passengers: number) => {
			switch (passengers) {
				case 1:
					return 'Buchung für eine Person';
				default:
					return `Buchung für ${passengers} Personen`;
			}
		},
		totalPrice: 'Gesamtpreis',
		cashOnly: 'Nur Barzahlung im Taxi',
		cancel: 'Stornieren',
		loginToBook: 'Einloggen zum Buchen',
		connection: 'Verbindung',
		ticket: 'Ticket',
		cancelTrip: 'Fahrt stornieren',
		cancelHeadline: 'Möchten Sie wirklich diese Fahrt stornieren?',
		noCancel: 'Nein, Fahrt nicht stornieren.',
		cancelDescription:
			'Die Stornierung der Fahrt kann nicht rückgängig gemacht werden. Eine Stornierung weniger als 24 Stunden vor der Fahrt ist mit Kosten verbunden.',
		pin: 'PIN:',
		pinExplainer:
			'Zur Weitergabe an den Fahrgast. Der Fahrgast muss die PIN beim Einstieg den Taxifahrer:innen mitteilen.',
		itineraryOnDate: 'Fahrt am',
		withVehicle: 'mit Fahrzeug'
	},

	explainer: {
		title: 'Explainer',
		p1: 'Leider deckt der ÖPNV nicht alles ab.',
		p2: 'Wir verwenden Taxis, um das Angebot des ÖPNV zu erweitern. Die Schnittmenge aus ÖPNV und Taxi nennen wir das ÖPNV-Taxi.',
		p3: 'Die Verbindungssuche findet ÖPNV-Verbindungen und zusätzlich ÖPNV-Taxi-Verbindungen, wenn der ÖPNV alleine nicht ausreichend ist.',
		alt1: 'Ein blauer Kreis, der rechts nicht ganz gefüllt ist. Der nicht gefüllte Teil ist schraffiert.',
		alt2: 'Ein blauer und ein gelber Kreis, die sich überlappen. Die Überlappung ist blau und gelb schraffiert.',
		alt3: 'Ein blauer Kreis dessen rechter Teil gelb schraffiert ist.'
	},
	ride: {
		myRideOffers: 'Meine Mitfahrangebote',
		create: 'Neues Mitfahrangebot anlegen',
		intro: 'Hinterlegen Sie Ihre Fahrt, um anderen Nutzern die Mitfahrt bei Ihnen anzubieten.',
		vehicle: 'Fahrzeug',
		addVehicle: 'Fahrzeug hinzufügen',
		outro:
			'Ihr Mitfahrangebot wird öffentlich in der Verbindungsauskunft angezeigt. Über Anfragen werden Sie per E-Mail benachrichtigt.',
		publish: 'Mitfahrangebot veröffentlichen',
		cancelTrip: 'Mitfahrangebot stornieren',
		cancelHeadline: 'Möchten Sie wirklich dieses Mitfahrangebot stornieren?',
		noCancel: 'Nein, Fahrt nicht stornieren.',
		cancelDescription:
			'Sie sollten ggf. vorhandene Mitfahrer persönlich informieren, auch wenn diese per E-Mail über die Stornierung benachrichtigt werden.',
		negotiateHere: 'Hier vereinbaren',
		negotiateHeader: 'Mitfahrgelegenheit vereinbaren',
		negotiatePrivacy:
			'Die folgenden Daten werden beim Senden der Anfrage mit der Person, die diese Mitfahrgelegenheit anbietet, geteilt:',
		negotiateExplanation:
			'Sie müssen den Preis und weitere Details mit der anbietenden Person vereinbaren.',
		startAndEnd: 'Start und Ziel der Fahrt',
		profile: 'Ihr Profil',
		email: 'Ihre E-Mail',
		phone: 'Ihre Telefonnummer',
		noPhone:
			'Sie haben keine Telefonnummer in Ihrem Account hinterlegt. Der Anbieter wird Sie daher nur per E-Mail kontaktieren können.',
		negotiateMessage: 'Nachricht an den Anbieter der Mitfahrgelegenheit',
		sendNegotiationRequest: 'Anfrage senden',
		requestBy: 'Anfrage von',
		acceptRequest: 'Mitfahrt bestätigen',
		requestAccepted: 'Mitfahrt bestätigt'
	},

	buttons: {
		addVehicle: 'Fahrzeug hinzufügen',
		uploadPhoto: 'Foto hochladen',
		savePhoto: 'Foto speichern',
		smokingOptions: ['nicht erlaubt', 'erlaubt']
	},

	rideShare: {
		maxPassengers: 'aximale Anzahl Mitfahrer',
		passengers: 'Mitfahrer',
		smokingInVehicle: 'Rauchen im Fahrzeug',
		color: 'Farbe',
		model: 'Fahrzeugmodell',
		specifyColor: 'Farbe angeben',
		specifyModel: 'Fahrzeugmodell angeben',
		luggage: 'Gepäckstücke',
		licensePlate: 'Nummernschild',
		createNewVehicle: 'Neues Fahrzeug anlegen',
		createVehicle: 'Fahrzeug anlegen',
		saveChanges: 'Änderungen speichern'
	}
};

export default translations;
