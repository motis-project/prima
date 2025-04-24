/* eslint-disable  @typescript-eslint/no-explicit-any */

import { render } from 'svelte/server';
import { convert } from 'html-to-text';
import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';

export type EmailContent = {
	text: string;
	html: string;
};

export function generateMail(template: any, props: any): EmailContent {
	const html = render(template, { props }).body;
	const text = convert(html, {
		selectors: [
			{ selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
			{ selector: 'img', format: 'skip' }
		]
	});
	return { html, text };
}

export async function send(subject: string, email: string, content: EmailContent) {
	const transporter = nodemailer.createTransport({
		host: env.MAIL_HOST,
		port: 465,
		secure: true,
		auth: {
			user: env.MAIL_USERNAME,
			pass: env.MAIL_SECRET_KEY
		}
	});

	await transporter.sendMail({
		from: env.EMAIL_SENDER,
		to: email,
		subject: subject,
		html: content.html,
		text: content.text
	});
}

export async function sendMail(template: any, subject: string, email: string, props: any) {
	return await send(subject, email, generateMail(template, props));
}
