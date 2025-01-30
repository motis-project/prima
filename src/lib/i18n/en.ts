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
		unkownError: 'Unbekannter Fehler',

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
		invalidSeats: 'Invalid number of seats',
		invalidLicensePlate: 'Invalid license plate.',
		invalidStorage: 'Invalid storage space.',
		duplicateLicensePlate: 'Duplicate license plate.',
		vehicleAddedSuccessfully: 'Vehicle added successfully.',

		// Booking
		noRouteFound: 'No route found.',
		distanceTooLong: 'Distance too long.',
		startDestTooClose: 'Distance too short.',
		maxTravelTimeExceeded: 'Maximum travel time exceeded.',
		minPrepTime: 'Not enough preparation time.',
		startDestNotInSameZone: 'Start and destination not in the same zone.',
		noVehicle: 'No vehicle available.',
		routingRequestFailed: 'Routing request failed.'
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
	journeyDetails: 'Journey Details',
	transfers: 'transfers',
	walk: 'Walk',
	bike: 'Bike',
	cargoBike: 'Cargo bike',
	scooterStanding: 'Standing kick scooter',
	scooterSeated: 'Seated kick scooter',
	car: 'Car',
	moped: 'Moped',
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
	roundtripStationReturnConstraint: 'The vehicle must be returned to the departure station.'
};

export default translations;
