import { browser } from '$app/environment';
import en from './en';
import de from './de';

export type Translations = {
	menu: {
		connections: string;
		bookings: string;
		account: string;
		availability: string;
		company: string;
		completedTours: string;
		employees: string;
		companies: string;
	};
	msg: {
		unkownError: string;

		// Account
		enterEmailAndPassword: string;
		invalidEmail: string;
		emailAlreadyRegistered: string;
		weakPassword: string;
		tooManyRequests: string;
		failedToSendVerificationEmail: string;
		accountDoesNotExist: string;
		invalidPassword: string;
		new: string;
		enterYourCode: string;
		codeExpiredSentAnother: string;
		incorrectCode: string;
		newCodeSent: string;
		enterNewPassword: string;
		passwordChanged: string;
		enterEmail: string;
		oldEmail: string;
		checkInboxToVerify: string;
		passwordResetSuccess: string;

		// Admin
		userDoesNotExist: string;
		activationSuccess: string;
		userAlreadyActivated: string;

		// Taxi Members
		driverAddedSuccessfully: string;
		ownerAddedSucessfully: string;

		// Company
		nameTooShort: string;
		addressTooShort: string;
		zoneNotSet: string;
		addressNotInZone: string;
		companyUpdateSuccessful: string;

		// AddVehicle
		invalidSeats: string;
		invalidLicensePlate: string;
		invalidStorage: string;
		duplicateLicensePlate: string;
		vehicleAddedSuccessfully: string;

		// Request
		requestCancelled: string;

		// Booking
		noRouteFound: string;
		distanceTooLong: string;
		startDestTooClose: string;
		maxTravelTimeExceeded: string;
		minPrepTime: string;
		startDestNotInSameZone: string;
		noVehicle: string;
		routingRequestFailed: string;

		// Booking
		bookingError: string;
		bookingError1: string;
		bookingError2: string;
		bookingSuccess: string;
	};
	admin: {
		completedToursSubtitle: string;
		activateTaxiOwners: string;
	};
	account: {
		name: string;
		email: string;
		password: string;
		create: string;
		login: string;
		sentAnEmailTo: string;
		changeYourEmail: string;
		emailVerification: string;
		verifySubtitle: string;
		changeEmail: string;
		resetPassword: string;
		resetPasswordSubtitle: string;
		changeEmailSubtitle: string;
		logout: string;
		logoutSubtitle: string;
		code: string;
		passwordReset: string;
		passwordResetSubtitle: string;
		passwordResetRequest: string;
		passwordResetRequestSubtitle: string;
		newPassword: string;
		resendCode: string;
		verify: string;
	};
	rating: {
		good: string;
		bad: string;
		sendFeedback: string;
	};
	journeyDetails: string;
	transfers: string;
	walk: string;
	bike: string;
	cargoBike: string;
	scooterStanding: string;
	scooterSeated: string;
	car: string;
	taxi: string;
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

const translations: Map<string, Translations> = new Map(Object.entries({ en, de }));

export const language = (browser ? navigator.languages.find((l) => l.length == 2) : 'de') ?? 'de';
export const t = translations.get(language) ?? de;
