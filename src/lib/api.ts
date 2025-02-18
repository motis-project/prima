export async function cancelTour(tourId: number, message: string) {
	await fetch('/api/cancelTour', {
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

export async function cancelRequest(requestId: number) {
	await fetch('/api/cancelRequest', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			requestId
		})
	});
}
