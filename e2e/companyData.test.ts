import { expect, test, type Page } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import { chooseFromTypeAhead, execSQL, login, TAXI_OWNER } from './utils';

test.describe.configure({ mode: 'serial' });

let taxiOwnerPasswordHash: string;

test.beforeAll(async () => {
	taxiOwnerPasswordHash = await hashPassword(TAXI_OWNER.password);
});

test.beforeEach(async () => {
	await execSQL(sql`
		DELETE FROM "session"
		WHERE user_id IN (SELECT id FROM "user" WHERE email = ${TAXI_OWNER.email})
	`);

	const company = await execSQL<{ id: number }>(sql`
		INSERT INTO company (lat, lng, name, address, zone, phone)
		VALUES (NULL, NULL, NULL, NULL, NULL, NULL)
		RETURNING id
	`);
	const companyId = company.rows[0].id;

	await execSQL(sql`
		INSERT INTO "user" (
			email,
			name,
			first_name,
			gender,
			zip_code,
			city,
			region,
			password_hash,
			is_email_verified,
			email_verification_code,
			email_verification_expires_at,
			password_reset_code,
			password_reset_expires_at,
			is_taxi_owner,
			is_admin,
			is_service,
			phone,
			company_id
		)
		VALUES (
			${TAXI_OWNER.email},
			${TAXI_OWNER.email},
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${taxiOwnerPasswordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			TRUE,
			FALSE,
			FALSE,
			NULL,
			${companyId}
		)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			first_name = EXCLUDED.first_name,
			gender = EXCLUDED.gender,
			zip_code = EXCLUDED.zip_code,
			city = EXCLUDED.city,
			region = EXCLUDED.region,
			password_hash = EXCLUDED.password_hash,
			is_email_verified = EXCLUDED.is_email_verified,
			email_verification_code = EXCLUDED.email_verification_code,
			email_verification_expires_at = EXCLUDED.email_verification_expires_at,
			password_reset_code = EXCLUDED.password_reset_code,
			password_reset_expires_at = EXCLUDED.password_reset_expires_at,
			is_taxi_owner = EXCLUDED.is_taxi_owner,
			is_admin = EXCLUDED.is_admin,
			is_service = EXCLUDED.is_service,
			phone = EXCLUDED.phone,
			company_id = EXCLUDED.company_id
	`);
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
