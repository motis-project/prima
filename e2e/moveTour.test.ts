import { test, expect } from '@playwright/test';
import { hashPassword } from '../src/lib/server/auth/password';
import { HOUR, MINUTE } from '../src/lib/util/time';
import { addVehicle, moveMouse, offset, dayString, in6Days, TAXI_OWNER } from './utils';
import {
	clearE2EData,
	seedAvailability,
	seedTourWithEvents,
	seedUser,
	seedVehicle,
	seedWeisswasserCompany
} from './testData';

test.beforeAll(async () => {
	const taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);

	await clearE2EData();
	const companyId = await seedWeisswasserCompany();
	const userId = await seedUser({
		email: TAXI_OWNER.email,
		passwordHash: taxiOwnerPasswordHash,
		companyId,
		isTaxiOwner: true
	});
	const vehicleId = await seedVehicle({ licensePlate: 'GR-TU-11', companyId });

	const availabilityStart = in6Days.getTime() + HOUR * 7;
	await seedAvailability({
		startTime: availabilityStart,
		endTime: availabilityStart + HOUR * 3,
		vehicleId
	});

	await seedTourWithEvents({
		vehicleId,
		customerId: userId,
		pickupTime: availabilityStart + HOUR,
		dropoffTime: availabilityStart + HOUR + MINUTE * 30
	});
});

test('Move tour to vehicle with cancelled tour', async ({ page }) => {
	await addVehicle(page, 'GR-TU-12');
	// Move Tour
	await page.waitForTimeout(500);
	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(1000);

	await moveMouse(page, `GR-TU-11-${dayString}T08:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-12-${dayString}T08:00:00.000Z`);
	await page.mouse.up();
	await page.waitForTimeout(500);

	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-12-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
	// Open TourDialog
	await page.mouse.down();
	await page.mouse.up();
	// Cancel Tour
	await page.getByText('Stornieren').click();
	await page.getByRole('textbox').fill('test');
	await page.getByText('Stornieren bestätigen').click();
	// Book new Tour
	await page.goto('/debug');

	await page.getByRole('textbox').fill(`${dayString}T08:30:00Z`);
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Request: ')).toBeVisible();

	await page.goto(`/taxi/availability?offset=${offset}&date=${dayString}`);
	await page.waitForTimeout(1000);
	// Move Tour to vehicle with cancelled Tour
	await moveMouse(page, `GR-TU-11-${dayString}T08:00:00.000Z`);
	await page.mouse.down();
	await moveMouse(page, `GR-TU-12-${dayString}T08:00:00.000Z`);
	await page.mouse.up();

	await expect(page.getByTestId(`GR-TU-11-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(254, 249, 195)'
	);
	await expect(page.getByTestId(`GR-TU-12-${dayString}T08:00:00.000Z`).locator('div')).toHaveCSS(
		'background-color',
		'rgb(251, 146, 60)'
	);
});
