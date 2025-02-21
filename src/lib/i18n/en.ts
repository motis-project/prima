import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Connections',
		bookings: 'Bookings',
		account: 'Account',
		availability: 'Availability',
		company: 'Company',
		completedTours: 'Tours',
		employees: 'Employees',
		companies: 'Companies'
	},
	msg: {
		// Unknown error
		unkownError: 'Unkown Error',

		// Account
		enterEmailAndPassword: 'Please enter your email and password.',
		invalidEmail: 'Invalid email address.',
		emailAlreadyRegistered: 'E-Mail already registered.',
		weakPassword: 'Weak password.',
		tooManyRequests: 'Too many requests.',
		failedToSendVerificationEmail: 'Failed to send the verification e-mail',
		accountDoesNotExist: 'Account does not exist.',
		invalidPassword: 'Invalid password.',
		new: 'New here? <a class="link" href="/account/signup">Create an account!</a>',
		enterYourCode: 'Please enter your code.',
		codeExpiredSentAnother: 'The verification code expired. We sent another code.',
		incorrectCode: 'Wrong code.',
		newCodeSent: 'We sent a new code to your inbox.',
		enterNewPassword: 'Please enter your new password.',
		passwordChanged: 'Password changed successfully.',
		enterEmail: 'Enter your e-mail address.',
		oldEmail: 'This is your old e-mail address.',
		checkInboxToVerify: 'Please check your inbox to verify your new e-mail address.',
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
		duplicateLicensePlate: 'Duplicate license plate.',
		vehicleAddedSuccessfully: 'Vehicle added successfully.',

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
		feedbackThank: 'Thank you very much for your feedback!'
	},
	admin: {
		completedToursSubtitle: 'Completed Tours',
		activateTaxiOwners: 'Activate taxi owner'
	},
	account: {
		name: 'Name',
		email: 'E-Mail',
		password: 'Password',
		create: 'Create Account',
		login: 'Login',
		sentAnEmailTo: 'We sent a code to',
		changeYourEmail: 'You can change your email address <a class="/account/settings">here</a>',
		emailVerification: 'E-Mail Verification',
		verifySubtitle: 'Verify your e-mail address with the code we sent to your inbox.',
		resetPassword: 'Reset Password',
		resetPasswordSubtitle: 'Change your password',
		changeEmail: 'Reset E-Mail',
		changeEmailSubtitle:
			'Change your e-mail address. We will send you a email with a verification code.',
		logout: 'Logout',
		logoutSubtitle: 'Log out of your account. You can login later any time.',
		code: 'Code',
		passwordReset: 'Reset Password',
		passwordResetSubtitle: 'Choose a new passwort.',
		passwordResetRequest: 'Request Password Reset',
		passwordResetRequestSubtitle: 'We will send a reset code to this e-mail.',
		newPassword: 'New Password',
		resendCode: 'Resend code',
		verify: 'Verify'
	},
	rating: {
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

	journeyDetails: 'Journey Details',
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

	bookingInfo: 'Booking Information',
	changeBookingInfo: 'Change your search options and booking information.',

	booking: {
		summary: 'Booking summary',
		header: 'Book ride (incurs cost)',
		disclaimer:
			"Cancel your ride 24h early if you don't want to take it. In case you do not cancel your ride in time or don't show up, you are liable to pay the full costs of the taxi.",
		noLuggage: 'No Luggage',
		handLuggage: 'Light Luggage',
		heavyLuggage: 'Heavy Luggage',
		foldableWheelchair: 'Foldable wheelchair',
		withFoldableWheelchair: 'With foldable wheelchair',
		bookingFor: (passengers: number) => {
			switch (passengers) {
				case 1:
					return 'One person';
				default:
					return `${passengers} persons`;
			}
		},
		totalPrice: 'Total price (payable in the taxi)',
		cancel: 'Cancel',
		loginToBook: 'Login to book',
		connection: 'Connection',
		ticket: 'Ticket',
		cancelHeadline: 'Do you really want to cancel this trip?',
		cancelDescription:
			'Cancellation cannot be undone. Cancellation less than 24 hours before the trip will incur costs.',
		cancelTrip: 'Cancel Trip',
		noCancel: 'No, I don not want to cancel.'
	}
};

export default translations;
