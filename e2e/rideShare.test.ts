import { Page, test } from '@playwright/test';
import { signup, RIDE_SHARE_PROVIDER, login, RIDE_SHARE_CUSTOMER } from './utils';

test.describe.configure({ mode: 'serial' });

test('add ride share tour', async ({ page }) => {
	await signup(page, RIDE_SHARE_PROVIDER, true);
	await page.goto('/account/add-ride-share-vehicle');
	await page.getByPlaceholder('DA-AB-1234').fill('DA-AB-1234');
	await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click();
	await page.waitForTimeout(1000);
	await page.goto('/ride-offers/new');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Von', 'schleife', 'Schleife Deutschland');
	await chooseFromTypeAhead(page, 'Nach', 'klein prie', 'Klein Priebus Krauschwitz');
	await page.locator('input[type="datetime-local"]').fill('2025-12-12T00:00');
	await page.getByRole('button', { name: 'Mitfahrangebot veröffentlichen' }).click();
	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Abmelden' }).click();
});

test('start ride share negotiation', async ({ page }) => {
	await signup(page, RIDE_SHARE_CUSTOMER, true);
	await page.goto('/routing');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Von', 'schleife', 'Schleife Deutschland');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Nach', 'klein prie', 'Klein Priebus Krauschwitz');
	await page.waitForTimeout(1000);
	await page.click('#bits-1');
	await page.locator('input[type="datetime-local"]').fill('2025-12-12T00:00');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(1000);
	await page.screenshot({ path: 'screenshots/findSearchResult.png', fullPage: true });
	await page.getByRole('button').nth(7).click();
	await page.getByRole('button', { name: 'Mitfahrgelegenheit vereinbaren' }).click();
	await page.getByRole('button', { name: 'Anfrage senden' }).click();
	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Abmelden' }).click();
});

test('accept ride share negotiation', async ({ page }) => {
	await login(page, RIDE_SHARE_PROVIDER);
	await page.goto('/bookings');
	await page.getByRole('button', { name: 'Meine Mitfahrangebote' }).click();
	await page.getByText('Dieses Mitfahrangebot hat offene Anfragen.').click();
	await page.getByRole('button', { name: 'Mitfahrt bestätigen' }).click();
});

async function chooseFromTypeAhead(
	page: Page,
	placeholder: string,
	search: string,
	expectedOption: string
) {
	await page.getByPlaceholder(placeholder).pressSequentially(search, { delay: 10 });
	const suggestion = page.getByText(expectedOption, { exact: true }).first();
	await page.waitForTimeout(1000);
	await page.screenshot({ path: 'screenshots/enterSearchLocation.png', fullPage: true });
	await suggestion.waitFor({ state: 'visible', timeout: 5000 });
	await suggestion.click();
}
