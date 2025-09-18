try {
	await fetch('http://prima:3000/apiInternal/sendNewVehicleNotice', {
		method: 'POST'
	});
} catch (err) {
	console.error('Error:', err);
}
