import { TOTPController } from "oslo/otp";
import { TimeSpan } from 'lucia';

export let emailstring = "";

export const writeEmailString = (email: string) => {
    emailstring = email;
};

export const getEmailString = (): string => {
    return emailstring;
};

function findNumbersInString(str: string): string {
    return str.replace(/[^0-9]/g, '');
};

function createSecret(userId: string): Uint8Array {
	let stringSecret = findNumbersInString(userId);
	return new Uint8Array(+stringSecret);
};

const digits = 6;
const period = new TimeSpan(10, "m");

export const genOTP = (userId: string): Promise<string> => {
    const totpCon = new TOTPController({digits, period});
	let secret = createSecret(userId);
	const otp = totpCon.generate(secret);
    return otp;
};

export const verifyOTP = (userId: string, otpPassword: string): Promise<boolean> => {
	const totpCon = new TOTPController({digits, period});
	let secret = createSecret(userId);
	const pass = totpCon.verify(otpPassword, secret);
	return pass;
};