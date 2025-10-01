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
		unknownError: string;

		// Account
		enterEmailAndPassword: string;
		invalidEmail: string;
		invalidPhone: string;
		invalidZipCity: string;
		emailAlreadyRegistered: string;
		weakPassword: string;
		tooManyRequests: string;
		failedToSendVerificationEmail: string;
		failedToSendPasswordResetEmail: string;
		accountDoesNotExist: string;
		invalidPassword: string;
		invalidOldPassword: string;
		new: string;
		enterYourCode: string;
		codeExpiredSentAnother: string;
		incorrectCode: string;
		newCodeSent: string;
		enterNewPassword: string;
		enterOldPassword: string;
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
		insufficientCapacities: string;
		duplicateLicensePlate: string;
		vehicleAddedSuccessfully: string;
		vehicleAlteredSuccessfully: string;

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
		vehicleConflict: string;

		// Booking
		bookingError: string;
		bookingError1: string;
		bookingError2: string;
		bookingSuccess: string;

		// Journey
		cancelled: string;
		stillNegotiating: string;
		openRequest: string;

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
		lastName: string;
		firstName: string;
		gender: (id: string) => string;
		email: string;
		password: string;
		phone: string;
		zipCode: string;
		city: string;
		region: string;
		create: string;
		forgotPassword: string;
		signupConditions: (tos: string, privacy: string, provider: string) => string;
		tos: string;
		imprint: string;
		dataLicenses: string;
		privacyShort: string;
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
		oldPassword: string;
		resendCode: string;
		verify: string;
	};
	rating: {
		thanksForUsing: string;
		howHasItBeen: string;
		giveFeedback: string;
		reason: string;
		tourism: string;
		commute: string;
		education: string;
		errands: string;
		leisure: string;
		howHasBookingBeen: string;
		howHasJourneyBeen: string;
		yourFeedback: string;
		good: string;
		bad: string;
		sendFeedback: string;
	};

	atDateTime: (timeType: TimeType, time: Date, isToday: boolean) => string;

	bookingsHeader: string;
	cancelledJourneys: string;
	noBookings: string;
	journeyDetails: string;
	transfer: string;
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
	rideSharing: string;
	rideSharingBookingRequired: string;
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
	storeItinerary: string;
	removeItinerary: string;
	introduction: string;
	publicTransitTaxi: string;
	serviceArea: string;
	serviceTime: string;
	serviceTimeContent: string;
	regionAround: string;
	perPerson: string;
	perRide: string;
	fare: string;
	bookingDeadline: string;
	bookingDeadlineContent: string;
	logo: string;
	toConnectionSearch: string;

	booking: {
		bookHere: string;
		summary: string;
		header: string;
		disclaimer: string;
		noLuggage: string;
		handLuggage: string;
		heavyLuggage: string;
		kidsDescription: string;
		kidsZeroToTwo: string;
		kidsThreeToFour: string;
		kidsFiveToSix: string;
		totalPrice: string;
		cashOnly: string;
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
		pin: string;
		pinExplainer: string;
		itineraryOnDate: string;
	};

	explainer: {
		title: string;
		p1: string;
		p2: string;
		p3: string;
		alt1: string;
		alt2: string;
		alt3: string;
	};
	ride: {
		myRideOffers: string;
		create: string;
		intro: string;
		vehicle: string;
		addVehicle: string;
		outro: string;
		publish: string;
		cancelTrip: string;
		cancelHeadline: string;
		noCancel: string;
		cancelDescription: string;
		negotiateHere: string;
		negotiateHeader: string;
		negotiatePrivacy: string;
		negotiateExplanation: string;
		profile: string;
		email: string;
		phone: string;
		noPhone: string;
		negotiateMessage: string;
		sendNegotiationRequest: string;
		requestBy: string;
		acceptRequest: string;
	};
};

const translations: Map<string, Translations> = new Map(Object.entries({ en, de }));
const translationsKey = (
	browser ? (navigator.languages.find((l) => translations.has(l.slice(0, 2))) ?? 'de') : 'de'
)?.slice(0, 2);

export const language = translationsKey ?? (browser ? navigator.language : 'de');
export const t = translationsKey ? translations.get(translationsKey)! : de;
