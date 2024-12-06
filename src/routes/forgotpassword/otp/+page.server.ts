import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    //console.log("das ist ok?");
	// if (event.locals.user) {
    //     
	// 	return redirect(302, '/forgotpassword/otp');
	// }
	return {};
};

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
		const passnumber = +password;
		if(passnumber !== 123456) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		if (!event.locals.user) {
			console.log('redirect guest to login');
			return redirect(302, '/login');
		}
		if (event.locals.user.is_maintainer) {
			console.log('redirect maintainer to /activation');
			return redirect(302, '/maintainer/activation');
		}
		if (event.locals.user.is_entrepreneur) {
			console.log('redirect entrepreneur to /company');
			return redirect(302, '/user/company');
		}
		return {
			user: event.locals.user
		};
		// TODO: nicht wegklickbares fenster mit password neu setzen - jeweils über die anderen routen legen
		// also in /maintainer/activation und /user/company 
	}
}