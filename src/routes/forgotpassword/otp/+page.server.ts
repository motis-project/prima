import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    console.log("das ok?");
	// if (event.locals.user) {
    //     
	// 	return redirect(302, '/forgotpassword/otp');
	// }
	return {};
};