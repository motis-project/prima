import { fail, redirect } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { db } from '$lib/database';
import { lucia } from '$lib/auth';
import type { Actions } from './$types';

import nodemailer from 'nodemailer';

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email');
		const password = formData.get('password');
		if (typeof email !== 'string' || email.length > 100 || !/.+@.+/.test(email)) {
			return fail(400, {
				message: 'Invalid email'
			});
		}
		if (typeof password !== 'string' || password.length < 6 || password.length > 255) {
			return fail(400, {
				message: 'Invalid password'
			});
		}

		const password_hash = await hash(password, {
			memoryCost: 19456,
			timeCost: 2,
			outputLen: 32,
			parallelism: 1
		});
		const id = generateId(15);
		const first_name = null;
		const last_name = null;
		const phone = null;
		const company_id = null;

		try {
			await db
				.insertInto('auth_user')
				.values({ id, email, password_hash, is_entrepreneur: false, is_maintainer: false })
				.values({
					id,
					email,
					password_hash,
					first_name,
					last_name,
					phone,
					company_id,
					is_entrepreneur: false,
					is_maintainer: false
				})
				.executeTakeFirst();

			const session = await lucia.createSession(id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			event.cookies.set(sessionCookie.name, sessionCookie.value, {
				path: '.',
				...sessionCookie.attributes
			});
		} catch (e: unknown) {
			// @ts-expect-error: 'e' is of type 'unknown'
			if (e['constraint'] === 'auth_user_email_key') {
				return fail(400, {
					message: 'email already used'
				});
			}
			return fail(500, {
				message: 'An unknown error occurred'
			});
		}
		// --- send welcome email --- 
		
		// does not work!
		//const emailHtml = render(Welcome, {name: "John"});
		let emailText = `
  			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Welcome Email</title>
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
					<h1>Welcome to Our Email Example</h1>
					<p>This is a simple HTML email template.</p>
					<p>It demonstrates basic HTML and CSS usage.</p>
					<p><a href="https://example.com">Visit our website</a></p>
				</body>
			</html>`;
		try {
			const transporter = nodemailer.createTransport({
				host: 'mailout.hrz.tu-darmstadt.de',
				port: 25,
				secure: false,
				// auth: {
				// 	user: 'smtp user',
				// 	pass: 'smtp password'
				// },
				tls: {
					rejectUnauthorized: true,
					//ciphers:'AES-256'
				}
			});
			const mailOptions = {
				//from: 'noreply@prima.motis-project.de',
				from: 'algo.informatik.tu-darmstadt.de',
				to: email,
				subject: 'Welcome email',
				html: emailText
				};
			console.log("welcome");
			//const messageinfo = await transporter.sendMail(mailOptions);
			//const response = messageinfo.response;
			console.log("welcome geschafft?");
		} catch (error) {
			console.error('Error sending welcome email:', error);
		}
		
		return redirect(302, '/');
	}
};
