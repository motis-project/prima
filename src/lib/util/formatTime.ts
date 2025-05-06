import { LOCALE, TZ } from '$lib/constants';
import type { UnixtimeMs } from '$lib/util/UnixtimeMs';

export const formatTime = (t: UnixtimeMs) => {
	return new Date(t).toLocaleString(LOCALE, {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: TZ
	});
};
