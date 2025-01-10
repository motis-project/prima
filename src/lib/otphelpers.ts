import { TOTPController } from 'oslo/otp';
import { TimeSpan } from 'lucia';

function findNumbersInString(str: string): string {
	return str.replace(/[^0-9]/g, '');
}

function createSecret(userId: string): Uint8Array {
	const stringSecret = findNumbersInString(userId);
	return new Uint8Array(+stringSecret);
}

const digits = 6;
const period = new TimeSpan(10, 'm');

export const genOTP = (userId: string): Promise<string> => {
	const totpCon = new TOTPController({ digits, period });
	const secret = createSecret(userId);
	const otp = totpCon.generate(secret);
	return otp;
};

export const verifyOTP = (userId: string, otpPassword: string): Promise<boolean> => {
	const totpCon = new TOTPController({ digits, period });
	const secret = createSecret(userId);
	const pass = totpCon.verify(otpPassword, secret);
	return pass;
};
