try {
	await fetch('http://prima:3000/apiInternal/captureAvailabilityState', {
		method: 'POST'
	});
} catch (err) {
	console.error('Error:', err);
}
