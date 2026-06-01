import { expect, test } from '@playwright/test';
import { hashPassword } from '../src/lib/server/auth/password';
import { TAXI_OWNER, login } from './utils';
import { clearE2EData, seedUser, seedWeisswasserCompany } from './testData';

test.describe.configure({ mode: 'serial' });

const unassignedUserEmails = [
	'driver1@test.de',
	'driver2@test.de',
	'admin2@test.de',
	'admin3@test.de'
];

test.beforeAll(async () => {
	const passwordHash = await hashPassword(TAXI_OWNER.password);

	await clearE2EData();
	const companyId = await seedWeisswasserCompany();

	await seedUser({
		email: TAXI_OWNER.email,
		passwordHash,
		companyId,
		isTaxiOwner: true
	});
	for (const email of unassignedUserEmails) {
		await seedUser({ email, passwordHash });
	}
});

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
