import { expect, test } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import { TAXI_OWNER, execSQL, login } from './utils';

test.describe.configure({ mode: 'serial' });

const unassignedUserEmails = [
	'driver1@test.de',
	'driver2@test.de',
	'admin2@test.de',
	'admin3@test.de'
];

test.beforeAll(async () => {
	const passwordHash = await hashPassword(TAXI_OWNER.password);

	await execSQL(sql`
		DELETE FROM journey;
		DELETE FROM availability;
		DELETE FROM event;
		DELETE FROM event_group;
		DELETE FROM ride_share_rating;
		DELETE FROM request;
		DELETE FROM tour;
		DELETE FROM ride_share_tour;
		DELETE FROM ride_share_vehicle;
		DELETE FROM vehicle;
		DELETE FROM session;
		DELETE FROM desired_ride_share;
		DELETE FROM "user";
		DELETE FROM company;
	`);

	const company = await execSQL<{ id: number }>(sql`
		INSERT INTO company (lat, lng, name, address, zone, phone)
		VALUES (
			51.493713,
			14.6258545,
			'Taxi Weißwasser',
			'Werner-Seelenbinder-Straße 70a, Weißwasser/Oberlausitz, Weißwasser/Oberlausitz, Sachsen',
			(SELECT id FROM zone WHERE name = 'Weißwasser' ORDER BY id DESC LIMIT 1),
			'555666'
		)
		RETURNING id
	`);
	const companyId = company.rows[0].id;

	await seedUser(TAXI_OWNER.email, passwordHash, companyId, true);
	for (const email of unassignedUserEmails) {
		await seedUser(email, passwordHash, null, false);
	}
});

async function seedUser(
	email: string,
	passwordHash: string,
	companyId: number | null,
	isTaxiOwner: boolean
) {
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
			${email},
			${email},
			'Vorname',
			'o',
			'ZIP',
			'City',
			'',
			${passwordHash},
			TRUE,
			NULL,
			NULL,
			NULL,
			NULL,
			${isTaxiOwner},
			FALSE,
			FALSE,
			NULL,
			${companyId}
		)
	`);
}

async function loginAndOpenMembers(page: Parameters<typeof login>[0]) {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/members');
}

test('Activate drivers', async ({ page }) => {
	await loginAndOpenMembers(page);
	await expect(page.getByRole('heading', { name: 'Fahrer freischalten' })).toBeVisible();
	const driverForm = page.locator('form[action="?/assignDriver"]');
	await driverForm.getByPlaceholder('Email').fill('driver1@test.de');
	await driverForm.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Fahrer erfolgreich hinzugefügt.')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'driver1@test.de' })).toHaveText('driver1@test.de');

	await page.reload();
	await expect(page.getByRole('cell', { name: 'driver1@test.de' })).toHaveText('driver1@test.de');
	await driverForm.getByPlaceholder('Email').fill('driver2@test.de');
	await driverForm.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Fahrer erfolgreich hinzugefügt.')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'driver2@test.de' })).toHaveText('driver2@test.de');
});

test('Deactivate driver', async ({ page }) => {
	await loginAndOpenMembers(page);
	await page.screenshot({ path: 'screenshots/afterLoggingInEntrepreneur.png', fullPage: true });
	await page
		.getByRole('row', { name: 'driver2@test.de Zugang zum Unternehmen löschen' })
		.getByRole('button')
		.click();
	await expect(page.getByRole('cell', { name: 'driver2@test.de' })).not.toBeVisible();
});

test('Activate administrator', async ({ page }) => {
	await loginAndOpenMembers(page);
	await expect(page.getByRole('heading', { name: 'Unternehmensverwaltung' })).toBeVisible();
	const ownerForm = page.locator('form[action="?/assignOwner"]');
	await ownerForm.getByPlaceholder('Email').fill('admin2@test.de');
	await ownerForm.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Verwaltungsnutzer erfolgreich hinzugefügt.')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'admin2@test.de' })).toBeVisible();

	await page.reload();
	await ownerForm.getByPlaceholder('Email').fill('admin3@test.de');
	await ownerForm.getByRole('button', { name: 'Freischalten' }).click();
	await expect(page.getByText('Verwaltungsnutzer erfolgreich hinzugefügt.')).toBeVisible();
	await expect(page.getByRole('cell', { name: 'admin3@test.de' })).toBeVisible();
});

test('Deactivate administrator', async ({ page }) => {
	await loginAndOpenMembers(page);
	await page
		.getByRole('row', { name: 'admin3@test.de Zugang zum Unternehmen löschen' })
		.getByRole('button')
		.click();
	await expect(page.getByRole('cell', { name: 'admin3@test.de' })).not.toBeVisible();
});
