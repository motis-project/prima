import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    //console.log("das ist ok?");
	// if (event.locals.user) {
    //     
	// 	return redirect(302, '/forgotpassword/otp');
	// }
	return {};
};

// internal error: durch updateXchange!
const xchange = { emailstring: 'initial-value' };
export function updateXchange(emailstring: string): void {
  xchange.emailstring = emailstring;
}

// Error Handling - wichtig, dass man nicht irgendwo hinkommt wo man noch nicht hin soll.
// neue spalte für einmalpasswort - generierung 

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password');

		if (typeof password !== 'string' || password.length !== 6) {
			return fail(400, {
				message: 'Invalid password'
			});
		}
		const passnumber = +password;
		if(passnumber !== 123456) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const existingUser = await db
			.selectFrom('auth_user')
			.selectAll()
			.where('email', '=', xchange.emailstring)
			.executeTakeFirst();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect email or password'
			});
		}

		// return fail(400, {
		// 	message: 'Incorrect email or password'
		// });

		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		return redirect(302, '/');
		// TODO: nicht wegklickbares fenster mit password neu setzen - jeweils über die anderen routen legen
		// also in /maintainer/activation und /user/company 
	}
}