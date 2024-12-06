import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions } from './$types';

import nodemailer from 'nodemailer';

// error, zeigt nicht die richtige seite an
// hydration_mismatch Hydration failed because the initial UI does not match what was rendered on the server

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email');

		if (typeof email !== 'string' || email.length > 100 || !/.+@.+/.test(email)) {
			return fail(400, {
				message: 'Invalid email'
			});
		}

		const existingUser = await db
			.selectFrom('auth_user')
			.selectAll()
			.where('email', '=', email)
			.executeTakeFirst();
		if (!existingUser) {
			return fail(400, {
				message: 'Incorrect email'
			});
		}

		const session = await lucia.createSession(existingUser.id, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

        // send one time password
		let emailText = `
  			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>OTP Email</title>
					<style>
						body {
							font-family: Arial, sans-serif;
							width: 600px;
							margin: 0 auto;
							padding: 20px;
							border: 1px solid #ddd;
						}
						h1 {
							color: #00698f;
							font-weight: bold;
							margin-top: 0;
						}
						p {
							margin-bottom: 20px;
						}
					</style>
				</head>
				<body>
					<h1>Welcome to Our Second Email Example</h1>
					<p>This is a simple HTML email template.</p>
					<p>It demonstrates basic HTML and CSS usage.</p>
					<p><a href="https://example.com">Visit our website</a></p>
				</body>
			</html>`;
        try {
			const transporter = nodemailer.createTransport({
				host: 'smtp. .de',
				port: 587,
				secure: false,
				auth: {
					user: 'user',
					pass: 'passwort'
				},
				tls: {
					rejectUnauthorized: true,
					ciphers:'SSLv3'
				}
			});
			const mailOptions = {
				from: 'mail address',
				to: email,
				subject: 'OTP email',
				html: emailText
				};
			console.log("otp?");
			await transporter.sendMail(mailOptions);
			console.log("otp geschafft?");
		} catch (error) {
			console.error('Error sending otp email:', error);
		}

		return redirect(302, '/forgotpassword/otp');
	}
};
