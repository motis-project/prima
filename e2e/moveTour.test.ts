import { test, expect } from '@playwright/test';
import { addVehicle, moveMouse, offset, dayString } from './utils';

test('Move tour to other vehicle', async ({ page }) => {
	await addVehicle(page, 'GR-TU-12');

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
});
