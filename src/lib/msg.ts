import { type Translations, t } from "./i18n/translation";

export type Msg = { type: 'success' | 'error'; text: keyof Translations["msg"] };

export const msg = (text: keyof Translations["msg"], type?: Msg['type']): Msg => {
	return { type: type ?? 'error', text };
}
