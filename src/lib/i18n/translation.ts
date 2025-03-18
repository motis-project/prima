import { browser } from '$app/environment';
import en from './en';
import de from './de';
import type { TimeType } from '$lib/util/TimeType';

export type Translations = {
	menu: {
		connections: string;
		bookings: string;
		account: string;
		availability: string;
		company: string;
		completedTours: string;
		accounting: string;
		employees: string;
		companies: string;
	};
	msg: {
		unkownError: string;

		// Account
		enterEmailAndPassword: string;
		invalidEmail: string;
		invalidPhone: string;
		emailAlreadyRegistered: string;
		weakPassword: string;
		tooManyRequests: string;
		failedToSendVerificationEmail: string;
		failedToSendPasswordResetEmail: string;
		accountDoesNotExist: string;
		invalidPassword: string;
		new: string;
		enterYourCode: string;
		codeExpiredSentAnother: string;
		incorrectCode: string;
		newCodeSent: string;
		enterNewPassword: string;
		passwordChanged: string;
		phoneChanged: string;
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

		// Journey
		cancelled: string;

		// Feedback
		feedbackThank: string;
		feedbackMissing: string;
	};
	admin: {
		completedToursSubtitle: string;
		activateTaxiOwners: string;
	};
	account: {
		name: string;
		email: string;
		password: string;
		phone: string;
		create: string;
		forgotPassword: string;
		signupConditions: (tos: string, privacy: string, provider: string) => string;
		tos: string;
		privacy: string;
		login: string;
		sentAnEmailTo: string;
		changeYourEmail: string;
		emailVerification: string;
		verifySubtitle: string;
		changeEmail: string;
		changePhone: string;
		resetPassword: string;
		resetPasswordSubtitle: string;
		changeEmailSubtitle: string;
		changePhoneSubtitle: string;
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
		thanksForUsing: string;
		howHasItBeen: string;
		giveFeedback: string;
		howHasJourneyBeen: string;
		yourFeedback: string;
		good: string;
		bad: string;
		sendFeedback: string;
	};

	atDateTime: (timeType: TimeType, time: Date, isToday: boolean) => string;

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
	odm: string;
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
	meetingPointNavigation: string;
	noItinerariesFound: string;
	bookingInfo: string;
	changeBookingInfo: string;
	booking: {
		summary: string;
		header: string;
		disclaimer: string;
		noLuggage: string;
		handLuggage: string;
		heavyLuggage: string;
		totalPrice: string;
		foldableWheelchair: string;
		withFoldableWheelchair: string;
		passengerNumber: string;
		bookingFor: (passengers: number) => string;
		cancel: string;
		loginToBook: string;
		connection: string;
		ticket: string;
		cancelHeadline: string;
		cancelDescription: string;
		cancelTrip: string;
		noCancel: string;
	};
};

const translations: Map<string, Translations> = new Map(Object.entries({ en, de }));
const translationsKey = (
	browser ? (navigator.languages.find((l) => translations.has(l.slice(0, 2))) ?? 'de') : 'de'
)?.slice(0, 2);

export const language = translationsKey ?? (browser ? navigator.language : 'de');
export const t = translationsKey ? translations.get(translationsKey)! : de;
