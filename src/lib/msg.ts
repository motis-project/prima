export type Msg = { type: 'success' | 'error'; text: string };

export const msg = (text: string, type?: Msg['type']): Msg => {
	return { type: type ?? 'error', text };
};
