import { test, expect } from '@playwright/test';
import { addVehicle, moveMouse, offset, dayString } from './utils';

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
	await page.waitForTimeout(1000);

	await page.getByRole('textbox').fill(`${dayString}T08:30:00Z`);
	await page.getByRole('button', { name: 'Suchen' }).click();
	await expect(page.getByText('Vehicle: ')).toBeVisible();

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
