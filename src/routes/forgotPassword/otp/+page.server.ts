import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';
import { verifyOTP } from "$lib/otphelpers";

export const load: PageServerLoad = async (event) => {
	// if (event.locals.user) {    
	// 	return redirect(302, '/forgotpassword/otp');
	// }
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password');

		if (typeof password !== 'string' || password.length !== 6) {
			return fail(400, {
				message: 'Invalid password'
			});
		}
		
		let currenturl = event.url.toString();
		let index = currenturl.indexOf("?", 7);
		let suburl = currenturl.slice(index + 1);
		const existingUser = await db
			.selectFrom('auth_user')
			.selectAll()
			.where('id', '=', suburl)
			.executeTakeFirst();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect email'
			});
		}
		const dbotp = await db
			.selectFrom('auth_user')
			.select('otp')
			.where('id', '=', suburl)
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

		return redirect(302, '/forgotPassword/changePassword');
	}
}