import type { Translations } from './translation';

const translations: Translations = {
	menu: {
		connections: 'Connections',
		bookings: 'Bookings',
		rideOffers: 'Ride offers',
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
		enterFirstLastName: 'Please enter your first and last name.',
		invalidEmail: 'Invalid email address.',
		invalidPhone: 'Invalid phone number.',
		invalidZipCity: 'Invalid ZIP code/city/region.',
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
		invalidCountry: 'Invalid country',
		invalidLicensePlate: 'Invalid license plate.',
		invalidStorage: 'Invalid storage space.',
		insufficientCapacities: 'Updated capacities are insufficient for planned tour on this vehicle.',
		duplicateLicensePlate: 'Duplicate license plate.',
		vehicleAddedSuccessfully: 'Vehicle added successfully.',
		vehicleAlteredSuccessfully: 'Vehicle altered successfully',

		//Request
		requestCancelled: 'Ride cancelled',

		// Booking
		noRouteFound: 'No route found. The maximum travel duration is two hours.',
		distanceTooLong: 'Distance too long.',
		startDestTooClose: 'Distance too short.',
		maxTravelTimeExceeded: 'Maximum travel time exceeded.',
		minPrepTime: 'Not enough preparation time.',
		startDestNotInSameZone: 'Start and destination not in the same zone.',
		noVehicle: 'No vehicle available.',
		routingRequestFailed: 'Routing request failed.',
		vehicleConflict: 'The selected vehicle is not available at the selected time.',

		// Booking
		bookingError: 'The ride could not be booked. Please start a new search.',
		bookingError1: 'First section could not be booked. Please start a new search.',
		bookingError2: 'Last section could not be booked. Please start a new search.',
		bookingSuccess: 'Booking successful.',

		// Journey
		cancelled: 'This trip has been cancelled.',
		stillNegotiating: 'The request has been sent. This ride is still being negotiated.',
		accepted: 'This ride has been agreed upon.',
		openRequest: 'This ride offer has open requests.',

		// Feedback
		feedbackThank: 'Thank you very much for your feedback!',
		feedbackMissing: 'No feedback given',

		// Picture Upload
		noFileUploaded: 'no file uploaded',
		invalidFileType: 'invalid file type',
		fileTooLarge: 'file too large',

		//Ride Sharing
		vehicleEditedSuccessfully: 'Vehicle edited successfully',
		rideShareAcceptError: 'Error. Possibly conflict with another accepted ride.'
	},
	admin: {
		completedToursSubtitle: 'Completed Tours',
		activateTaxiOwners: 'Activate taxi owner'
	},
	account: {
		name: 'Name',
		lastName: 'Last Name',
		firstName: 'First Name',
		gender: (id: string) => {
			return { o: 'non-binary', f: 'Ms.', m: 'Mr.', n: 'not specified' }[id]!;
		},
		genderShort: (id: string) => {
			return { o: '(non-binary)', f: '(f)', m: '(m)', n: '' }[id]!;
		},
		genderString: 'Gender',
		email: 'Email',
		password: 'Password',
		phone: 'Phone Number',
		zipCode: 'ZIP Code',
		city: 'City',
		region: 'Region',
		create: 'Create Account',
		forgotPassword: 'Forgot your password?',
		signupConditions: (tos: string, privacy: string, provider: string) =>
			`By registering, I agree to the ${tos} and the ${privacy} of ${provider}.`,
		tos: 'terms of service',
		imprint: 'Imprint',
		dataLicenses: 'Timetable Data Sources',
		privacyShort: 'Privacy Policy',
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
		verify: 'Verify',
		profilePicture: 'Profile Picture',
		profilePictureSubtitle: 'Change your profile picture here',
		personalInfo: 'Personal Information',
		adjustPersonalInfo: 'Change your personal information here',
		updatePersonalInfo: 'Update personal info',
		vehicleListRideShare: 'List of vehicles for ride sharing',
		vehicleListSubtitle: 'You can edit a vehicle by clicking on it in the list below.'
	},
	rating: {
		thanksForUsing: 'Thank you for using the public transport taxi.',
		howHasItBeen: 'How has it been?',
		giveFeedback: 'Give us your feedback.',
		reason: 'Reason for the journey',
		tourism: 'Tourism',
		commute: 'Commute',
		education: 'Education (School/College)',
		errands: 'Errands',
		leisure: 'Leisure',
		howHasBookingBeen: 'Were you satisfied with the booking process?',
		howHasJourneyBeen: 'Were you satisfied with the journey?',
		yourFeedback: 'Your feedback',
		good: 'yes',
		bad: 'no',
		sendFeedback: 'Send feedback',
		backToHome: 'Back to the homepage'
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

	bookingsHeader: 'My booked and saved journeys',
	cancelledJourneys: 'Past and Cancelled Journeys',
	noBookings: 'There are no bookings or stored itineraries yet.',
	noRideOffers: 'You have not yet offered any rides.',
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
	rideSharing: 'Ride sharing offer',
	rideSharingBookingRequired: 'Ride sharing offer, negotiation required!',
	rideSharingInfo:
		'These are private ride-sharing offers. If you are interested in a private ride-sharing connection, you can send a request to the provider to arrange the details. Register to create ride-sharing offers and send requests.',
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
		'The PriMa+ÖV project augments public transport with on-demand taxis and private ride-sharing options. The goal is to ensure a service at least every two hours, even in rural areas and at off-peak times. More about ',
	publicTransitTaxi: 'Public-transit Taxi',
	serviceArea: 'Service area',
	serviceTime: 'Service time',
	serviceTimeContent: 'generally between 5 a.m. and 10 p.m. (depending on taxi availability)',
	regionAround: 'Region around',
	perPerson: 'per person',
	perRide: 'per ride',
	fare: 'Fare',
	bookingDeadline: 'Booking deadline',
	bookingDeadlineContent: 'at least 1 hour in advance.',
	logo: 'The PriMa+ÖV logo. Iconographic representation of a car, bus, train and cab.',
	toConnectionSearch: 'Go to connection search',
	luggageExplanation:
		'Approximate number of transportable items in handluggage size. A big suitcase corresponds to about three handluggage items.',
	addAlert: 'Receive a notification if a ride sharing offer matching this search is published',

	booking: {
		bookHere: 'Hier buchen. Preis',
		summary: 'Summary',
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
		kidsSevenToFourteen: '7 - 14 years',
		fifteenPlus: '15 years and older',
		underSeven: 'under 7 years',
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
		ptTicketNeeded: 'In addition, a valid public transport ticket is required.',
		cancel: 'Cancel',
		loginToBook: 'Login to book',
		connection: 'Connection',
		ticket: 'Ticket',
		cancelHeadline: 'Do you really want to cancel this trip?',
		cancelDescription:
			'Cancellation cannot be undone. Cancellation less than 24 hours before the trip will incur costs.',
		cancelTrip: 'Cancel Trip',
		noCancel: 'No, I do not want to cancel.',
		pin: 'PIN:',
		pinExplainer:
			'To give to the passenger. The passenger must give this PIN to the taxi driver when starting the journey.',
		itineraryOnDate: 'Journey on',
		withVehicle: 'with vehicle'
	},

	explainer: {
		title: 'Explainer',
		p1: 'Unfortunately, public transport does not cover everything.',
		p2: 'We use cabs to extend the range of public transport services. We call the intersection of public transport and cab the public transport cab.',
		p3: 'The connection search finds public transport connections and also public transport cab connections if public transport alone is not sufficient.',
		alt1: 'A blue circle that is not completely filled on the right. The unfilled part is hatched.',
		alt2: 'A blue and a yellow circle that overlap. The overlap is hatched blue and yellow.',
		alt3: 'A blue circle whose right-hand part is hatched yellow.'
	},
	ride: {
		myRideOffers: 'My ride offers',
		create: 'Create new ride offer',
		intro: 'Enter your journey to offer other users to ride with you.',
		vehicle: 'Vehicle',
		addVehicle: 'Add vehicle',
		outro:
			'Your offer will be visible to everybody using the journey planner. You will be notified about requests via e-mail.',
		publish: 'Publish ride offer',
		cancelTrip: 'Cancel ride offer',
		cancelHeadline: 'Do you really want to cancel this ride offer?',
		noCancel: 'No, I do not want to cancel.',
		cancelDescription:
			'You should inform any people riding with you yourself, even if they will receive an email about the cancellation.',
		negotiateHere: 'Negotiate here',
		negotiateHeader: 'Negotiate the ride',
		negotiatePrivacy:
			'The following data will be shared with the person offering the ride when sending the negotiation request:',
		negotiateExplanation:
			'You need to negotiate the price and exact pickup location and time with the person offering this ride.',
		startAndEnd: 'Start and destination of the journey',
		profile: 'Your profile',
		email: 'Your email',
		phone: 'Your phone',
		noPhone:
			'You have not set a phone number in your account. The person offering the ride will only be able to contact you via email.',
		negotiateMessage: 'Message to the person offering the ride',
		sendNegotiationRequest: 'Send negotiation request',
		requestBy: 'Request from',
		offerBy: 'Offered by',
		acceptRequest: 'Confirm ride',
		requestAccepted: 'Ride confirmed',
		requestCancelled: 'Ride cancelled',
		showMap: 'Show map'
	},

	buttons: {
		addVehicleTitle: 'Add vehicle for ride offers',
		addVehicle: 'Add vehicle',
		editVehicle: 'edit selected vehicle',
		uploadPhoto: 'Select photo',
		savePhoto: 'Save photo',
		photoSaved: 'Photo saved',
		smokingOptions: ['not allowed', 'allowed']
	},

	rideShare: {
		maxPassengers: 'Maximum Number of Ride Share Passengers',
		passengers: 'Ride Share Passengers',
		smokingInVehicle: 'Smoking in the vehicle',
		vehiclePhoto: 'Photo',
		color: 'Color',
		model: 'Car Model',
		specifyColor: 'Specify Color',
		specifyModel: 'Specify Model',
		luggage: 'Luggage',
		licensePlate: 'License Plate',
		createNewVehicle: 'Create new Vehicle',
		createVehicle: 'Create Vehicle',
		saveChanges: 'Save changes',
		preview: 'preview',
		feedbackPrompt: 'Please rate your journey with',
		feedbackPromptProvider: 'Please rate your recent ride share passenger',
		howHasItBeen: 'You can rate your last ride share experience here',
		editVehicle: 'Edit Vehicle',
		closeTo: 'close to',
		defaultLicensePlate: 'Default vehicle'
	}
};

export default translations;
