// import { expect, test } from '@playwright/test';
// import { login, ENTREPENEUR, hammerF5 } from './testUtils';

// test('Set company data, incomplete 1', async ({ page }) => {
// 	await login(page, ENTREPENEUR);
// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

// 	await page.getByLabel('Name').fill('Test');
// 	await page.getByRole('button', { name: 'Übernehmen' }).click();

// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
// 	await expect(page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')).toBeVisible();
// 	await expect(page.getByText('Es wurde kein Gebiet ausgewählt.')).toBeVisible();
// 	await expect(page.getByText('Es wurde keine Gemeinde ausgewählt.')).toBeVisible();
// });

// test('Set company data, incomplete 2', async ({ page }) => {
// 	await login(page, ENTREPENEUR);
// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

// 	await page.getByLabel('Name').fill('Test');
// 	await page.getByLabel('Unternehmenssitz').fill('Plantagenweg 3, 02827 Görlitz');
// 	await page.getByRole('button', { name: 'Übernehmen' }).click();

// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
// 	await expect(
// 		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
// 	).not.toBeVisible();
// 	await expect(page.getByText('Es wurde kein Gebiet ausgewählt.')).toBeVisible();
// 	await expect(page.getByText('Es wurde keine Gemeinde ausgewählt.')).toBeVisible();
// 	// await expect(page.getByText('Die Daten wurden übernommen.')).not.toBeVisible();
// });

// test('Set company data, incomplete 3', async ({ page }) => {
// 	await login(page, ENTREPENEUR);
// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

// 	await page.getByLabel('Name').fill('Taxi Weißwasser');
// 	await page
// 		.getByLabel('Unternehmenssitz')
// 		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
// 	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
// 	await page.getByRole('button', { name: 'Übernehmen' }).click();

// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
// 	await expect(
// 		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
// 	).not.toBeVisible();
// 	await expect(page.getByText('Es wurde kein Gebiet ausgewählt.')).not.toBeVisible();
// 	await expect(page.getByText('Es wurde keine Gemeinde ausgewählt.')).toBeVisible();
// 	// await expect(page.getByText('Die Daten wurden übernommen.')).not.toBeVisible();
// });

// test('Set company data, address not in community', async ({ page }) => {
// 	await login(page, ENTREPENEUR);
// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

// 	await page.getByLabel('Name').fill('Taxi Weißwasser');
// 	await page.getByLabel('Unternehmenssitz').fill('Plantagenweg 3, 02827 Görlitz');
// 	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
// 	await page.getByLabel('Gemeinde').selectOption({ label: 'Weißwasser/O.L.' });
// 	await page.getByRole('button', { name: 'Übernehmen' }).click();

// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
// 	await expect(
// 		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
// 	).not.toBeVisible();
// 	await expect(page.getByText('Es wurde kein Gebiet ausgewählt.')).not.toBeVisible();
// 	await expect(page.getByText('Es wurde keine Gemeinde ausgewählt.')).not.toBeVisible();
// 	await expect(page.getByTestId('community-error')).toHaveText(
// 		'Die Addresse liegt nicht in der ausgewählten Gemeinde.'
// 	);
// 	// await expect(page.getByText('Die Daten wurden übernommen.')).not.toBeVisible();
// });

// test('Set company data, complete and consistent', async ({ page }) => {
// 	await login(page, ENTREPENEUR);
// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

// 	await page.getByLabel('Name').fill('Taxi Weißwasser');
// 	await page
// 		.getByLabel('Unternehmenssitz')
// 		.fill('Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz');
// 	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: 'Görlitz' });
// 	await page.getByLabel('Gemeinde').selectOption({ label: 'Weißwasser/O.L.' });
// 	await page.getByRole('button', { name: 'Übernehmen' }).click();

// 	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();
// 	await expect(
// 		page.getByText('Die Eingabe muss mindestens 2 Zeichen enthalten.')
// 	).not.toBeVisible();
// 	await expect(page.getByText('Es wurde kein Gebiet ausgewählt.')).not.toBeVisible();
// 	await expect(page.getByText('Es wurde keine Gemeinde ausgewählt.')).not.toBeVisible();
// 	await expect(page.getByTestId('community-error')).not.toHaveText(
// 		'Die Addresse liegt nicht in der ausgewählten Gemeinde.'
// 	);
// 	await expect(page.getByText('Die Daten wurden übernommen.')).toBeVisible();

// 	await hammerF5(page);

// 	await expect(page.getByLabel('Name')).toHaveValue('Taxi Weißwasser');
// 	await expect(page.getByLabel('Unternehmenssitz')).toHaveValue(
// 		'Werner-Seelenbinder-Straße 70A, 02943 Weißwasser/Oberlausitz'
// 	);
// 	await expect(page.getByLabel('Pflichtfahrgebiet')).toHaveValue('2' /* Görlitz */);
// 	await expect(page.getByLabel('Gemeinde')).toHaveValue('85' /* Weißwasser */);
// });
