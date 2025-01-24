import { db } from "$lib/server/db";

export function verifyEmailInput(email: string): boolean {
  return /^.+@.+\..+$/.test(email) && email.length < 256;
}

export async function isEmailAvailable(email: string) {
  const numberOfUsersWithEMail = (await db
    .selectFrom('user')
    .select(db.fn.countAll().as('count'))
    .where('email', '=', email)
    .executeTakeFirstOrThrow())
    .count;
  return numberOfUsersWithEMail == 0;
}