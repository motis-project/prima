import { randomBytes } from 'crypto';

export function generateSecurePassword(length: number = 16): string {
	const charset =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[];:,.?';
	const bytes = randomBytes(length);
	let password = '';
	for (let i = 0; i < length; i++) {
		const index = bytes[i] % charset.length;
		password += charset[index];
	}
	return password;
}
