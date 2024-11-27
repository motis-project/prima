import { expect, type Page } from '@playwright/test';

export type UserCredentials = {
	email: string;
	password: string;
};

export type Company = {
	name: string;
	street: string;
	houseNumber: string;
	postalCode: string;
	city: string;
	zone: string;
	community: string;
};

export const MAINTAINER: UserCredentials = {
	email: 'master@example.com',
	password: 'longEnough1'
};

export const ENTREPENEUR: UserCredentials = {
	email: 'taxi1@test.de',
	password: 'longEnough2'
};

export const ENTREPENEUR2: UserCredentials = {
	email: 'taxi2@test.de',
	password: 'longEnough2'
};

export const COMPANY1: Company = {
	name: 'Taxi Weißwasser',
	street: 'Werner-Seelenbinder-Straße',
	houseNumber: '70A',
	postalCode: '02943',
	city: 'Weißwasser/Oberlausitz',
	zone: 'Weißwasser',
	community: 'Weißwasser/O.L.'
};

export const COMPANY2: Company = {
	name: 'Taxi Gablenz',
	street: 'Schulstraße',
	houseNumber: '21',
	postalCode: '02953',
	city: 'Gablenz',
	zone: 'Weißwasser',
	community: 'Gablenz'
};

export async function login(page: Page, credentials: UserCredentials) {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.password);
	await page.getByRole('button', { name: 'Login' }).click();
	await page.waitForTimeout(500);
}

export async function signup(page: Page, credentials: UserCredentials) {
	await page.goto('/signup');
	await expect(page.getByRole('heading', { name: 'Neuen Account erstellen' })).toBeVisible();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.password);
	await page.getByRole('button', { name: 'Account erstellen' }).click();
	await expect(
		page.getByRole('heading', { name: 'Willkommen beim Projekt PrimaÖV!' })
	).toBeVisible();
	await page.getByRole('link', { name: 'Logout' }).click();
	await page.waitForTimeout(500);
}

export async function setCompanyData(page: Page, user: UserCredentials, company: Company) {
	await login(page, user);
	await expect(page.getByRole('heading', { name: 'Stammdaten Ihres Unternehmens' })).toBeVisible();

	await page.getByLabel('Name').fill(company.name);
	await page.getByLabel('Hausnummer').fill(company.houseNumber);
	await page.getByLabel('Straße').fill(company.street);
	await page.getByLabel('Stadt').fill(company.city);
	await page.getByLabel('Postleitzahl').fill(company.postalCode);
	await page.waitForTimeout(250);
	await page.getByLabel('Pflichtfahrgebiet').selectOption({ label: company.zone });
	await page.getByLabel('Gemeinde').selectOption({ label: company.community });
	await page.screenshot({ path: 'screenshots/afterEnteringCompanyData.png', fullPage: true });
	await page.getByRole('button', { name: 'Übernehmen' }).click();
	await page.waitForTimeout(500);
	await page.screenshot({ path: 'screenshots/afterSetCompany.png', fullPage: true });
}

export async function addVehicle(page: Page, licensePlate: string) {
	await login(page, ENTREPENEUR);
	await page.goto('/user/company');
	await page.waitForTimeout(500);
	await page.screenshot({ path: 'screenshots/beforeNavigateToTaxi.png', fullPage: true });
	await page.getByRole('link', { name: 'Taxi' }).click();
	await expect(page.getByRole('heading', { name: 'Fahrzeuge und Touren' })).toBeVisible();
	await page.waitForTimeout(500);
	await page.getByRole('button', { name: 'Fahrzeug hinzufügen' }).click();
	await page.getByPlaceholder('DA-AB-1234').fill(licensePlate);
	await page.getByLabel('3 Passagiere').check();
	await page
		.locator('button')
		.filter({ hasText: /^Fahrzeug hinzufügen$/ })
		.click();
	await page.waitForTimeout(500);
}
