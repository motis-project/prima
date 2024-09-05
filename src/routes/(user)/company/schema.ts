import { z } from 'zod';

export const formSchema = z.object({
	companyname: z
		.string()
		.min(2, { message: 'Die Eingabe muss mindestens 2 Zeichen enthalten.' })
		.max(50, { message: 'Die Eingabe darf höchstens 50 Zeichen enthalen.' }),
	address: z.string().min(2, { message: 'Die Eingabe muss mindestens 2 Zeichen enthalten.' }),
	zone: z.number().gt(0, { message: 'Es muss ein Pflichtfahrgebiet ausgewählt werden.' }),
	community: z.number().gt(0, { message: 'Es muss eine Gemeinde ausgewählt werden.' })
});

export type FormSchema = typeof formSchema;
