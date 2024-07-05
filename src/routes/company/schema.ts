import { z } from 'zod';

export const formSchema = z.object({
	companyname: z
		.string()
		.min(2, { message: 'Die Eingabe muss mindestens 2 Zeichen enthalten.' })
		.max(50, { message: 'Die Eingabe darf höchstens 50 Zeichen enthalen.' }),
	address: z.string().min(2, { message: 'Die Eingabe muss mindestens 2 Zeichen enthalten.' }),
	zone: z.string().min(2, { message: 'Es wurde kein Gebiet ausgewählt.' }),
	community: z.string().min(2, { message: 'Es wurde keine Gemeinde ausgewählt.' })
});

export type FormSchema = typeof formSchema;
