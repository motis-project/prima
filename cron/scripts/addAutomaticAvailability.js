try {
	const response = await fetch('http://prima:3000/apiInternal/addAutomaticAvailability', {
		method: 'POST'
	});
	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`);
	}
} catch (error) {
	console.error('Failed to add automatic availability:', error);
	process.exitCode = 1;
}
