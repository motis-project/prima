import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';
import { getEmailString, verifyOTP } from "$lib/otphelpers"; // über link lösen

export const load: PageServerLoad = async (event) => {
	// if (event.locals.user) {    
	// 	return redirect(302, '/forgotpassword/otp');
	// }
	return {};
};

// TODO: Aus dem link die id lesen und den db check anpassen
// dann die getEmailString Funktion löschen
// Error Handling - wichtig, dass man nicht irgendwo hinkommt wo man noch nicht hin soll.

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password');

		if (typeof password !== 'string' || password.length !== 6) {
			return fail(400, {
				message: 'Invalid password'
			});
		}
		
		const existingUser = await db
			.selectFrom('auth_user')
			.selectAll()
			.where('email', '=', getEmailString())
			.executeTakeFirst();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect email'
			});
		}

		const dbotp = await db
			.selectFrom('auth_user')
			.select('otp')
			.where('id', '=', existingUser.id)
			.executeTakeFirst();

		if(dbotp === undefined || dbotp === null) {
			return fail(400, {
				message: 'OneTimePassword is not set'
			});
		}

		const passVerify = verifyOTP(existingUser.id, password);
		let passedVerify = (await passVerify).valueOf();
		
		if(!passedVerify || dbotp.otp !== password)
		{
			return fail(400, {
				message: 'Incorrect OneTimePassword'
			});
		}

		console.log("verified");

		// hier setzen oder erst später? 
		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		return redirect(302, '/forgotPassword/changePassword');
	}
}