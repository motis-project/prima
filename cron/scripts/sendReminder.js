try {
	await fetch('http://prima:3000/apiInternal/sendReminder', {
		method: 'POST'
	});
} catch (err) {
	console.error('Error:', err);
}
