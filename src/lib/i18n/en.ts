import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Connections',
		bookings: 'Bookings',
		account: 'Account'
	},
	msg: {
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
		checkInboxToVerify: 'Please check your inbox to verify your new e-mail address.'
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
		code: 'Code'
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
