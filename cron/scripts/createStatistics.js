try {
	await fetch('http://prima:3000/apiInternal/createStatistics', {
		method: 'POST'
	});
} catch (err) {
	console.error('Error:', err);
}
