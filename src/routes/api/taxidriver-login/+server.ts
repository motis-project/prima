import { error, json, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/database';
import { sql } from 'kysely';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 's3cReTKey!24#@LKD93Jnv90!jfKJDF';

export const POST = async (event) => {
	console.log(event);

	const request = event.request;
	const { email, password } = (await request.json()) as AuthRequest;

	console.log(email);
	console.log(password);

	return json(jwt.sign({ email, password }, JWT_SECRET, { expiresIn: '10h' }));
};

interface AuthRequest {
	email: string;
	password: string;
}
