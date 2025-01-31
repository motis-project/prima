/* eslint-disable  @typescript-eslint/no-explicit-any */

import { render } from 'svelte/server';
import { convert } from 'html-to-text';
import { EMAIL_SENDER, SCW_DEFAULT_PROJECT_ID, SCW_SECRET_KEY } from '$env/static/private';
import { PUBLIC_PROVIDER } from '$env/static/public';

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

async function send(subject: string, email: string, content: EmailContent) {
	await fetch('https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Auth-Token': SCW_SECRET_KEY
		},
		body: JSON.stringify({
			project_id: SCW_DEFAULT_PROJECT_ID,
			from: {
				name: PUBLIC_PROVIDER,
				email: EMAIL_SENDER
			},
			to: [{ email }],
			subject,
			...content
		})
	}).then((response) => {
		if (!response.ok) {
			console.log('sending email failed: ', response);
			throw new Error('Bad response from server');
		}
		return response;
	});
}

export async function sendMail(template: any, subject: string, email: string, props: any) {
	return await send(subject, email, generateMail(template, props));
}
