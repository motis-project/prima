export const readInt = (x: FormDataEntryValue | null): number =>
	x === null ? NaN : parseInt(x.toString());

export const readFloat = (x: FormDataEntryValue | null): number =>
	x === null ? NaN : parseFloat(x.toString());
