import { msg, type Msg } from '$lib/msg';
import { fail, type ActionFailure } from '@sveltejs/kit';

const phoneRegex = /^\+?(?:[ ]?[-]?[ ]?\d){0,15}$/;

export function verifyPhone(
	phone: FormDataEntryValue | null
): null | string | ActionFailure<{ msg: Msg; phone: string }> {
	if (phone != null) {
		if (typeof phone !== 'string' || !phoneRegex.test(phone)) {
			return fail(400, { msg: msg('invalidPhone'), phone: '' });
		}
		phone = phone.replaceAll('-', '').replaceAll(' ', '');
	}
	return phone;
}
