import { expect, Page, test } from '@playwright/test';
import {
	signup,
	RIDE_SHARE_PROVIDER,
	login,
	RIDE_SHARE_CUSTOMER,
	execSQL,
	UserCredentials
} from './utils';
import { sql } from 'kysely';

test.describe.configure({ mode: 'serial' });

test('add ride share tour', async ({ page }) => {
	await signup(page, RIDE_SHARE_PROVIDER, true);
	await page.goto('/account/add-ride-share-vehicle');
	await page.getByPlaceholder('DA-AB-1234').fill('DA-AB-1234');
	await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click();
	await page.waitForTimeout(1000);
	await page.goto('/ride-offers/new');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Von', 'schleife', 'Schleife ');
	await chooseFromTypeAhead(page, 'Nach', 'klein prie', 'Klein Priebus Krauschwitz');
	await page.locator('input[type="datetime-local"]').fill('2025-12-12T03:02');
	await page.getByRole('button', { name: 'Mitfahrangebot veröffentlichen' }).click();
	await logout(page);
});

test('start ride share negotiation', async ({ page }) => {
	await signup(page, RIDE_SHARE_CUSTOMER, true);
	await page.goto('/routing');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Von', 'schleife', 'Schleife ');
	await page.waitForTimeout(1000);
	await chooseFromTypeAhead(page, 'Nach', 'klein prie', 'Klein Priebus Krauschwitz');
	await page.waitForTimeout(1000);
	await page.click('#bits-1');
	await page.locator('input[type="datetime-local"]').fill('2025-12-12T03:00');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(2000);
	await page.screenshot({ path: 'screenshots/findSearchResult.png', fullPage: true });
	await page.getByRole('button').nth(7).click();
	await page.getByRole('button', { name: 'Mitfahrgelegenheit vereinbaren' }).click();
	await page.getByRole('button', { name: 'Anfrage senden' }).click();
	await logout(page);
});

test('accept ride share negotiation', async ({ page }) => {
	await login(page, RIDE_SHARE_PROVIDER);
	await page.goto('/bookings');
	await page.getByRole('button', { name: 'Meine Mitfahrangebote' }).click();
	await page.getByText('Dieses Mitfahrangebot hat offene Anfragen.').click();
	await page.getByRole('button', { name: 'Mitfahrt bestätigen' }).click();
	await logout(page);
});

test('verify feedback banners are correct', async ({ page }) => {
	test.setTimeout(90000);
	// Feedback banner is not visible since tour is not in the past
	await isFeedbackBannerVisible(page, RIDE_SHARE_PROVIDER, false);
	await isFeedbackBannerVisible(page, RIDE_SHARE_CUSTOMER, false);

	// manipulate tour to be in the past
	await execSQL(sql`UPDATE event
		SET communicated_time = 1
		FROM request
		INNER JOIN ride_share_tour 
		    ON request.ride_share_tour = ride_share_tour.id
		WHERE event.request = request.id;
	`);

	// Feedback banners are visible now
	await isFeedbackBannerVisible(page, RIDE_SHARE_PROVIDER, true);
	await isFeedbackBannerVisible(page, RIDE_SHARE_CUSTOMER, true);

	//Give feedback as customer
	await giveFeedback(page, RIDE_SHARE_CUSTOMER, 4);

	// Verify feedback banner for provider is still visible
	await isFeedbackBannerVisible(page, RIDE_SHARE_PROVIDER, true);

	// Reset Feedback
	await execSQL(sql`DELETE FROM ride_share_rating;`);

	//Give feedback as provider
	await giveFeedback(page, RIDE_SHARE_PROVIDER, 2);

	// give feedback as customer again
	await giveFeedback(page, RIDE_SHARE_CUSTOMER, 4);
});

async function chooseFromTypeAhead(
	page: Page,
	placeholder: string,
	search: string,
	expectedOption: string
) {
	await page.getByPlaceholder(placeholder).pressSequentially(search, { delay: 10 });
	const suggestion = page.getByText(new RegExp(`^\\s*${expectedOption}`, 'i')).first();
	await suggestion.waitFor({ state: 'visible', timeout: 5000 });
	await suggestion.click();
}

async function logout(page: Page) {
	await page.goto('/account/settings');
	await page.getByRole('button', { name: 'Abmelden' }).click();
}

async function isFeedbackBannerVisible(page: Page, user: UserCredentials, xpct: boolean) {
	await login(page, user);
	await page.goto('/routing');
	if (xpct) {
		await expect(
			page.getByText('Sie können Ihre letzte Mitfahrerfahrung hier bewerten ')
		).toBeVisible();
	} else {
		await expect(
			page.getByText('Sie können Ihre letzte Mitfahrerfahrung hier bewerten ')
		).not.toBeVisible();
	}
	await logout(page);
}

async function giveFeedback(page: Page, user: UserCredentials, stars: number) {
	await login(page, user);
	await page.goto('/routing');
	await page.waitForTimeout(1000);
	await page.getByText('Geben Sie uns Ihr Feedback').click();
	await page.waitForTimeout(1000);
	await page.locator(`[data-testid="star-${stars}"]`).click();
	await page.waitForTimeout(1000);
	await page.getByText('Feedback abschicken').click();
	await page.goto('/routing');
	await expect(
		page.getByText('Sie können Ihre letzte Mitfahrerfahrung hier bewerten ')
	).not.toBeVisible();
	await logout(page);
}
