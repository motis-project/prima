import { test, expect, type Page } from '@playwright/test';
import { sql } from 'kysely';
import { hashPassword } from '../src/lib/server/auth/password';
import { execSQL, login, TAXI_OWNER } from './utils';
import { clearE2EData, seedUser, seedVehicle, seedWeisswasserCompany } from './testData';

let companyId: number;

test.beforeAll(async () => {
	await clearE2EData();
	companyId = await seedWeisswasserCompany();
	await seedUser({
		email: TAXI_OWNER.email,
		passwordHash: await hashPassword(TAXI_OWNER.password),
		companyId,
		isTaxiOwner: true
	});
	await seedVehicle({ licensePlate: 'GR-AA-1', companyId, setAutomaticAvailability: true });
	await seedVehicle({ licensePlate: 'GR-AA-2', companyId });
});

// The vehicle table is rendered twice (morning and afternoon), use the first one.
const checkbox = (page: Page, licensePlate: string) =>
	page.getByRole('checkbox', { name: `Automatisch: ${licensePlate}` }).first();

const automaticVehicles = async () =>
	(
		await execSQL<{ licensePlate: string }>(sql`
			SELECT license_plate AS "licensePlate" FROM vehicle
			WHERE company = ${companyId} AND set_automatic_availability = true
			ORDER BY license_plate
		`)
	).rows.map((r) => r.licensePlate);

test('Select multiple vehicles for automatic availability, keeping at least one', async ({
	page
}) => {
	await login(page, TAXI_OWNER);
	await page.goto('/taxi/availability');

	await expect(checkbox(page, 'GR-AA-1')).toBeChecked();
	await expect(checkbox(page, 'GR-AA-2')).not.toBeChecked();

	// The only selected vehicle stays selected.
	await checkbox(page, 'GR-AA-1').click();
	await page.waitForTimeout(500);
	await expect(checkbox(page, 'GR-AA-1')).toBeChecked();
	expect(await automaticVehicles()).toEqual(['GR-AA-1']);

	// Multiple vehicles can be selected.
	await checkbox(page, 'GR-AA-2').click();
	await expect(checkbox(page, 'GR-AA-2')).toBeChecked();
	await expect(checkbox(page, 'GR-AA-1')).toBeChecked();
	await expect.poll(automaticVehicles).toEqual(['GR-AA-1', 'GR-AA-2']);

	// Once another vehicle is selected, the first one can be deselected ...
	await checkbox(page, 'GR-AA-1').click();
	await expect(checkbox(page, 'GR-AA-1')).not.toBeChecked();
	await expect.poll(automaticVehicles).toEqual(['GR-AA-2']);

	// ... and now the remaining one stays selected.
	await checkbox(page, 'GR-AA-2').click();
	await page.waitForTimeout(500);
	await expect(checkbox(page, 'GR-AA-2')).toBeChecked();
	expect(await automaticVehicles()).toEqual(['GR-AA-2']);
});
