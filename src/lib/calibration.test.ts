import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { removeSteps, type CalibrationItinerary } from './calibration';

describe('tests for calibration helper functions', () => {
	it('remove steps', async () => {
		fs.readFile('compressedItineraryWithStops.json', 'utf-8', (err, data) => {
			if (err) {
				console.error('Error reading file:', err);
				return;
			}
			const itineraryWithSteps: CalibrationItinerary = JSON.parse(data);
			fs.readFile('compressedItineraryWithoutStops.json', 'utf-8', (err, data) => {
				if (err) {
					console.error('Error reading file:', err);
					return;
				}
				const itineraryWithoutSteps: CalibrationItinerary = JSON.parse(data);
			});
			expect(JSON.stringify(removeSteps(itineraryWithSteps)));
		});
	});
});
