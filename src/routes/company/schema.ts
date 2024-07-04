import { z } from 'zod';

export const formSchema = z.object({
	companyname: z
		.string()
		.min(2, { message: 'Die Eingabe muss mindestens 2 Zeichen enthalten.' })
		.max(50, { message: 'Die Eingabe darf höchstens 50 Zeichen enthalen.' }),
	email: z.string().email('Die Eingabe ist keine gülite Email-Adresse.'),
	address: z.string().min(2, { message: 'TODO' }),
	zone: z.string().min(2, { message: 'Es wurde kein Gebiet ausgewählt.' }),
	community: z.string().min(2, { message: 'Es wurde keine Gemeinde ausgewählt.' })
});

export type FormSchema = typeof formSchema;
