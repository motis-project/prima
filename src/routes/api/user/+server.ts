import { error, json } from '@sveltejs/kit';
import { db } from '$lib/database';

export const PUT = async (event) => {
	const company = event.locals.user?.company;
	if (!company) {
		error(400, {
			message: 'not allowed without write access to company'
		});
	}
	const request = event.request;
	const userMail = event.locals.user?.email;
	try {
		const { email } =
			await request.json();
		if (email == userMail) {
			error(400, {
				message: 'not allowed for this user'
			});
		}
		const user = await db
			.selectFrom('auth_user')
			.where('company_id', '=', company)
			.where('email', '=', email)
			.selectAll()
			.executeTakeFirst();
		if (user == null) {
			error(404, {
				message: 'user not found'
			});
		}
		if (user!.is_entrepreneur) {
			await db
				.updateTable('auth_user')
				.set({
					is_entrepreneur: false
				})
				.where('company_id', '=', company)
				.where('email', '=', email)
				.executeTakeFirst();
		} else {
			await db
				.updateTable('auth_user')
				.set({
					company_id: null
				})
				.where('company_id', '=', company)
				.where('email', '=', email)
				.executeTakeFirst();
		}
	} catch (e) {
		error(500, {
			message: 'An unknown error occurred'
		});
	}
	return json({});
};
