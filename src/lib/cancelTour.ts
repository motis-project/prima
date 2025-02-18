export async function cancelTour(tourId: number, message: string) {
	await fetch('http://localhost:5173/api/cancelTour', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			tourId,
			message
		})
	});
}
