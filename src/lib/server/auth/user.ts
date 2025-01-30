import { db } from '$lib/server/db';
import { hashPassword } from './password';

export async function updateUserPassword(userId: number, password: string): Promise<void> {
	const passwordHash = await hashPassword(password);
	await db
		.updateTable('user')
		.set({ passwordHash: passwordHash })
		.where('id', '=', userId)
		.execute();
}

export async function getUserPasswordHash(userId: number) {
	return (
		await db
			.selectFrom('user')
			.select('passwordHash')
			.where('id', '=', userId)
			.executeTakeFirstOrThrow()
	).passwordHash;
}

export async function getUserFromEmail(email: string) {
	return await db.selectFrom('user').selectAll().where('email', '=', email).executeTakeFirst();
}
