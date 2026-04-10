try {
	await fetch('http://prima:3000/apiInternal/availabilityCompensation', {
		method: 'POST'
	});
} catch (err) {
	console.error('Error:', err);
}
