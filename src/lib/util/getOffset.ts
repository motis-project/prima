import { LOCALE, TZ } from '$lib/constants';
import { HOUR } from './time';
import type { UnixtimeMs } from './UnixtimeMs';

export const getOffset = (t: UnixtimeMs) => {
	return (
		HOUR *
		(parseInt(
			new Date(t).toLocaleString(LOCALE, {
				hour: '2-digit',
				hour12: false,
				timeZone: TZ
			})
		) -
			12)
	);
};
