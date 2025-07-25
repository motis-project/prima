import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Connections',
		bookings: 'Bookings',
		account: 'Account',
		availability: 'Availability',
		company: 'Company',
		completedTours: 'Tours',
		accounting: 'Accounting',
		employees: 'Employees',
		companies: 'Companies'
	},
	msg: {
		// Unknown error
		unknownError: 'Unknown Error',

		// Account
		enterEmailAndPassword: 'Please enter your email and password.',
		invalidEmail: 'Invalid email address.',
		invalidPhone: 'Invalid phone number.',
		emailAlreadyRegistered: 'Email already registered.',
		weakPassword: 'Weak password.',
		tooManyRequests: 'Too many requests.',
		failedToSendVerificationEmail: 'Failed to send the verification email.',
		failedToSendPasswordResetEmail: 'Failed to send the password reset email.',
		accountDoesNotExist: 'Account does not exist.',
		invalidPassword: 'Invalid password.',
		invalidOldPassword: 'Invalid old password.',
		new: 'New here? <a class="link" href="/account/signup">Create an account!</a>',
		enterYourCode: 'Please enter your code.',
		codeExpiredSentAnother: 'The verification code expired. We sent another code.',
		incorrectCode: 'Wrong or expired code.',
		newCodeSent: 'We sent a new code to your inbox.',
		enterNewPassword: 'Please enter your new password.',
		enterOldPassword: 'Please enter your old password.',
		passwordChanged: 'Password changed successfully.',
		phoneChanged: 'Phone number changed successfully.',
		enterEmail: 'Enter your email address.',
		oldEmail: 'This is your old email address.',
		checkInboxToVerify: 'Please check your inbox to verify your new email address.',
		passwordResetSuccess:
			'Your password has been reset successfully. Please login with your new password.',

		// Admin
		userDoesNotExist: 'User does not exist.',
		activationSuccess: 'User already activated.',
		userAlreadyActivated: 'User has already been activated.',

		// Taxi Members
		driverAddedSuccessfully: 'Driver added successfully.',
		ownerAddedSucessfully: 'Company admin added successfully.',

		// Company
		nameTooShort: 'Name too short.',
		addressTooShort: 'Address too short.',
		zoneNotSet: 'Zone not set.',
		addressNotInZone: 'Address not in zone.',
		companyUpdateSuccessful: 'Company data updated successfully.',

		// AddVehicle
		invalidSeats: 'Invalid number of passengers',
		invalidLicensePlate: 'Invalid license plate.',
		invalidStorage: 'Invalid storage space.',
		insufficientCapacities: 'Updated capacities are insufficient for planned tour on this vehicle.',
		duplicateLicensePlate: 'Duplicate license plate.',
		vehicleAddedSuccessfully: 'Vehicle added successfully.',
		vehicleAlteredSuccessfully: 'Vehicle altered successfully',

		//Request
		requestCancelled: 'Ride cancelled',

		// Booking
		noRouteFound: 'No route found.',
		distanceTooLong: 'Distance too long.',
		startDestTooClose: 'Distance too short.',
		maxTravelTimeExceeded: 'Maximum travel time exceeded.',
		minPrepTime: 'Not enough preparation time.',
		startDestNotInSameZone: 'Start and destination not in the same zone.',
		noVehicle: 'No vehicle available.',
		routingRequestFailed: 'Routing request failed.',

		// Booking
		bookingError: 'The ride could not be booked.',
		bookingError1: 'First section could not be booked.',
		bookingError2: 'Last section could not be booked.',
		bookingSuccess: 'Booking successful.',

		// Journey
		cancelled: 'This trip has been cancelled.',

		// Feedback
		feedbackThank: 'Thank you very much for your feedback!',
		feedbackMissing: 'No feedback given'
	},
	admin: {
		completedToursSubtitle: 'Completed Tours',
		activateTaxiOwners: 'Activate taxi owner'
	},
	account: {
		name: 'Name',
		email: 'Email',
		password: 'Password',
		phone: 'Phone Number',
		create: 'Create Account',
		forgotPassword: 'Forgot your password?',
		signupConditions: (tos: string, privacy: string, provider: string) =>
			`By registering, I agree to the ${tos} and the ${privacy} of ${provider}.`,
		tos: 'terms of service',
		imprint: 'Imprint',
		privacy_short: 'Privacy Policy',
		privacy: 'privacy policy',
		login: 'Login',
		sentAnEmailTo: 'We sent a code to',
		changeYourEmail: 'You can change your email address <a class="/account/settings">here</a>',
		emailVerification: 'Email Verification',
		verifySubtitle: 'Verify your email address with the code we sent to your inbox.',
		resetPassword: 'Reset Password',
		resetPasswordSubtitle: 'Change your password',
		changeEmail: 'Reset Email',
		changePhone: 'Reset Phone Number',
		changeEmailSubtitle:
			'Change your email address. We will send you an email with a verification code.',
		changePhoneSubtitle: 'Change your phone number.',
		logout: 'Logout',
		logoutSubtitle: 'Log out of your account. You can log in later any time.',
		code: 'Code',
		passwordReset: 'Reset Password',
		passwordResetSubtitle: 'Choose a new password.',
		passwordResetRequest: 'Request Password Reset',
		passwordResetRequestSubtitle: 'We will send a reset code to this email.',
		newPassword: 'New Password',
		oldPassword: 'Old Password',
		resendCode: 'Resend code',
		verify: 'Verify'
	},
	rating: {
		thanksForUsing: 'Thank you for using the public transport taxi.',
		howHasItBeen: 'How has it been?',
		giveFeedback: 'Give us your feedback.',
		howHasJourneyBeen: 'How has the journey been?',
		yourFeedback: 'Your feedback',
		good: 'good',
		bad: 'bad',
		sendFeedback: 'Send feedback'
	},

	atDateTime: (timeType, t: Date, isToday: boolean) =>
		`${timeType === 'departure' ? 'Depart at ' : 'Arrive at '} ` +
		t.toLocaleString('en', {
			hour: '2-digit',
			minute: '2-digit',
			weekday: isToday ? undefined : 'short',
			day: isToday ? undefined : '2-digit',
			month: isToday ? undefined : '2-digit',
			year: isToday ? undefined : '2-digit'
		}),

	cancelledJourneys: 'Past and Cancelled Journeys',
	noBookings: 'There are no bookings or stored itineraries yet.',
	journeyDetails: 'Journey Details',
	transfer: 'transfer',
	transfers: 'transfers',
	walk: 'Walk',
	bike: 'Bike',
	cargoBike: 'Cargo bike',
	scooterStanding: 'Standing kick scooter',
	scooterSeated: 'Seated kick scooter',
	car: 'Car',
	taxi: 'Taxi',
	moped: 'Moped',
	odm: 'Public Transport Taxi, booking required!',
	from: 'From',
	to: 'To',
	arrival: 'Arrival',
	departure: 'Departure',
	duration: 'Duration',
	arrivals: 'Arrivals',
	later: 'later',
	earlier: 'earlier',
	departures: 'Departures',
	switchToArrivals: 'Switch to arrivals',
	switchToDepartures: 'Switch to departures',
	track: 'Track',
	arrivalOnTrack: 'Arrival on track',
	tripIntermediateStops: (n: number) => {
		switch (n) {
			case 0:
				return 'No intermediate stops';
			case 1:
				return '1 intermediate stop';
			default:
				return `${n}  intermediate stops`;
		}
	},
	sharingProvider: 'Provider',
	roundtripStationReturnConstraint: 'The vehicle must be returned to the departure station.',
	meetingPointNavigation: 'Navigate to meeting point',
	noItinerariesFound: 'No itineraries found.',

	bookingInfo: 'Booking Information',
	changeBookingInfo: 'Change your search options and booking information.',
	storeItinerary: 'Save Itinerary',
	removeItinerary: 'Remove Itinerary',
	introduction:
		'The <a href="https://www.primaplusoev.de/" class="link" target="_blank">PriMa+ÖV</a> project augments public transport with on-demand taxis and, later, ride-sharing options. The goal is to ensure a service at least every two hours, even in rural areas and at off-peak times.',
	publicTransitTaxi: 'Public-transit Taxi',
	serviceArea: 'Service area',
	serviceTime: 'Service time',
	serviceTimeContent: 'generally between 5 a.m. and 10 p.m. (depending on taxi availability)',
	regionAround: 'Region around',
	perPerson: 'per person',
	perRide: 'per ride',
	fare: 'Fare',
	bookingDeadline: 'Booking deadline',
	bookingDeadlineContent: 'at least 1 hour in advance, weekend bookings until Friday 6 p.m.',
	logo: 'The PriMa+ÖV logo. Iconographic representation of a car, bus, train and cab.',
	toConnectionSearch: 'Go to connection search',

	booking: {
		bookHere: 'Hier buchen. Preis',
		summary: 'Booking summary',
		header: 'Book ride (incurs cost)',
		disclaimer:
			"Cancel your ride one hour early if you don't want to take it. In case you do not cancel your ride in time or don't show up, you are liable to pay the full call-out-fee of the taxi.",
		noLuggage: 'No luggage',
		handLuggage: 'Hand luggage',
		heavyLuggage: 'Heavy luggage',
		kidsDescription:
			'Please specify how many of these passengers fall into the following age groups:',
		kidsZeroToTwo: '0 - 2 years',
		kidsThreeToFour: '3 - 4 years',
		kidsFiveToSix: '5 - 6 years',
		foldableWheelchair: 'Foldable wheelchair',
		withFoldableWheelchair: 'With foldable wheelchair',
		passengerNumber: 'Number of people',
		bookingFor: (passengers: number) => {
			switch (passengers) {
				case 1:
					return 'One person';
				default:
					return `${passengers} persons`;
			}
		},
		totalPrice: 'Total price',
		cashOnly: 'Cash payment only',
		cancel: 'Cancel',
		loginToBook: 'Login to book',
		connection: 'Connection',
		ticket: 'Ticket',
		cancelHeadline: 'Do you really want to cancel this trip?',
		cancelDescription:
			'Cancellation cannot be undone. Cancellation less than 24 hours before the trip will incur costs.',
		cancelTrip: 'Cancel Trip',
		noCancel: 'No, I do not want to cancel.'
	},

	explainer: {
		title: 'Explainer',
		p1: 'Unfortunately, public transport does not cover everything.',
		p2: 'We use cabs to extend the range of public transport services. We call the intersection of public transport and cab the public transport cab.',
		p3: 'The connection search finds public transport connections and also public transport cab connections if public transport alone is not sufficient.',
		alt1: 'A blue circle that is not completely filled on the right. The unfilled part is hatched.',
		alt2: 'A blue and a yellow circle that overlap. The overlap is hatched blue and yellow.',
		alt3: 'A blue circle whose right-hand part is hatched yellow.'
	}
};

export default translations;
