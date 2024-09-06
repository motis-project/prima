import { expect, type Page } from '@playwright/test';

export type UserCredentials = {
	email: string;
	password: string;
};

export const MAINTAINER: UserCredentials = {
	email: 'master@example.com',
	password: 'longEnough1'
};

export const ENTREPENEUR: UserCredentials = {
	email: 'taxi@example.com',
	password: 'longEnough2'
};

export async function login(page: Page, credentials: UserCredentials) {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
	await page.getByLabel('Email').fill(credentials.email);
	await page.getByLabel('Password').fill(credentials.password);
	await page.getByRole('button', { name: 'Login' }).click();
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
}
