import { expect, test, type Page } from '@playwright/test';
import { hashPassword } from '../src/lib/server/auth/password';
import { chooseFromTypeAhead, login, TAXI_OWNER } from './utils';
import { clearSessionsForUser, seedCompany, seedUser } from './testData';

test.describe.configure({ mode: 'serial' });

let taxiOwnerPasswordHash: string;

test.beforeAll(async () => {
	taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);
});

test.beforeEach(async () => {
	await clearSessionsForUser(TAXI_OWNER.email);
	const companyId = await seedCompany({
		lat: null,
		lng: null,
		name: null,
		address: null,
		zoneName: null,
		phone: null
	});
	await seedUser({
		email: TAXI_OWNER.email,
		passwordHash: taxiOwnerPasswordHash,
		companyId,
		isTaxiOwner: true,
		upsert: true
	});
});

async function loginAndOpenCompanyData(page: Page) {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/company');
}

test('Set company data, incomplete 1', async ({ page }) => {
	await loginAndOpenCompanyData(page);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Test');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Adresse zu kurz.')).toBeVisible();
});

test('Set company data, incomplete 2', async ({ page }) => {
	await loginAndOpenCompanyData(page);

	await page.getByLabel('Name').fill('Test');
	await page.getByLabel('Unternehmenssitz').fill('Plantagenweg 3, 02827 Görlitz');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Pflichtfahrgebiet nicht gesetzt.')).toBeVisible();
});

test('Set company data, incomplete 3', async ({ page }) => {
	await loginAndOpenCompanyData(page);

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await page
		.getByLabel('Unternehmenssitz')
		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Die Adresse liegt nicht im Pflichtfahrgebiet.')).toBeVisible();
});

test('Set company data, complete and consistent', async ({ page }) => {
	await loginAndOpenCompanyData(page);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await chooseFromTypeAhead(
		page,
		'Unternehmenssitz',
		'Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz',
		'Werner-Seelenbinder-Straße 70a'
	);
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Weißwasser' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByText('Unternehmensdaten erfolgreich aktualisiert.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	const checkData = async () => {
		await expect(page.getByLabel('Name')).toHaveValue('Taxi Weißwasser');
		await expect(page.getByLabel('Unternehmenssitz')).toHaveValue(
			'Werner-Seelenbinder-Straße 70a, Weißwasser/Oberlausitz, Weißwasser/Oberlausitz, Sachsen'
		);
		await expect(page.getByLabel('Pflichtfahrgebiet').locator('option:checked')).toHaveText(
			'Weißwasser'
		);
	};

	await checkData();
	await page.reload();
	await checkData();
});
