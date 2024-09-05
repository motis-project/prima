import { expect, test } from '@playwright/test';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { dbConfig } from './config';
import pg from 'pg';
import { login, signup, MAINTAINER, ENTREPENEUR, hammerF5 } from './testUtils';

test.describe.configure({ mode: 'serial' });

test('signup maintainer', async ({ page }) => {
	await signup(page, MAINTAINER);
	const db = new Kysely<unknown>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({ ...dbConfig, database: 'prima' })
		})
	});
	await sql`UPDATE auth_user SET is_maintainer = true WHERE email = 'master@example.com'`.execute(
		db
	);
	db.destroy();
});

test('signup taxi', async ({ page }) => {
	await signup(page, ENTREPENEUR);
});

test('activate taxi', async ({ page }) => {
	await login(page, MAINTAINER);
	await expect(page.getByRole('heading', { name: 'Unternehmer freischalten' })).toBeVisible();
	await page.getByLabel('Email').fill(ENTREPENEUR.email);
	await page.getByRole('button', { name: 'Unternehmer freischalten' }).click();
	await expect(page.getByText('Freischalten erfolgreich!')).toBeVisible();
});

test('Set company data, incomplete 1', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Test');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
	await expect(page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')).toBeVisible();
});

test('Set company data, incomplete 2', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Test');
	await page.getByLabel('Unternehmenssitz').fill('Plantagenweg 3, 02827 Görlitz');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
	await expect(
		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
	).not.toBeVisible();
	await expect(
		page.getByText('Die Addresse liegt nicht in der ausgewählten Gemeinde.')
	).toBeVisible();
});

test('Set company data, incomplete 3', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await page
		.getByLabel('Unternehmenssitz')
		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
	await expect(
		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
	).not.toBeVisible();
	await expect(
		page.getByText('Die Addresse liegt nicht in der ausgewählten Gemeinde.')
	).toBeVisible();
});

test('Set company data, address not in community', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await page.getByLabel('Unternehmenssitz').fill('Plantagenweg 3, 02827 Görlitz');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
	await page.getByLabel('Gemeinde').selectOption({ label: 'Weißwasser/O.L.' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
	await expect(
		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
	).not.toBeVisible();
	await expect(
		page.getByText('Die Addresse liegt nicht in der ausgewählten Gemeinde.')
	).toBeVisible();
});

test('Set company data, complete and consistent', async ({ page }) => {
	await login(page, ENTREPENEUR);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill('Taxi Weißwasser');
	await page
		.getByLabel('Unternehmenssitz')
		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
	await page.getByLabel('Gemeinde').selectOption({ label: 'Weißwasser/O.L.' });
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
	await expect(
		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
	).not.toBeVisible();
	await expect(
		page.getByText('Die Addresse liegt nicht in der ausgewählten Gemeinde.')
	).toBeVisible();
	await expect(page.getByText('Die Daten wurden übernommen.')).toBeVisible();

	await hammerF5(page);

	await expect(page.getByLabel('Name')).toHaveValue('Taxi Weißwasser');
	await expect(page.getByLabel('Unternehmenssitz')).toHaveValue(
		'Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz'
	);
	await expect(page.getByLabel('Pflichtfahrgebiet')).toHaveValue('2' /* Görlitz */);
	await expect(page.getByLabel('Gemeinde')).toHaveValue('85' /* Weißwasser */);
});
