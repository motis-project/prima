import { LICENSE_PLATE_REGEX } from '$lib/constants';
import { msg } from '$lib/msg';
import { readInt } from '$lib/server/util/readForm';
import { replacePhoto } from '$lib/server/util/uploadPhoto';
import { fail } from '@sveltejs/kit';

export async function prepareVehicleUAddOrpdate(formData: FormData, userId: number) {
	const licensePlate = formData.get('licensePlate');
	const color = formData.get('color');
	const hasColorString = formData.get('hasColorString');
	const model = formData.get('model');
	const hasModelString = formData.get('hasModelString');
	const smokingAllowedString = formData.get('smokingAllowed');
	const luggage = readInt(formData.get('luggage'));
	const passengers = readInt(formData.get('passengers'));
	const vehiclePicture = formData.get('vehiclePicture');
	if (passengers !== 1 && passengers !== 2 && passengers !== 3 && passengers !== 4) {
		return fail(400, { msg: msg('invalidSeats') });
	}
	if (typeof licensePlate !== 'string' || !LICENSE_PLATE_REGEX.test(licensePlate)) {
		return fail(400, { msg: msg('invalidLicensePlate') });
	}
	if (typeof color !== 'string') {
		return fail(400);
	}
	if (typeof model !== 'string') {
		return fail(400);
	}
	if (smokingAllowedString !== null && typeof smokingAllowedString !== 'string') {
		return fail(400);
	}
	if (typeof hasColorString !== 'string') {
		return fail(400);
	}
	if (typeof hasModelString !== 'string') {
		return fail(400);
	}
	const smokingAllowed = smokingAllowedString === '1';
	const hasColor = hasColorString === '1';
	const hasModel = hasModelString === '1';
	if (isNaN(luggage) || luggage <= 0 || luggage >= 11) {
		return fail(400, { msg: msg('invalidStorage') });
	}
	let vehiclePicturePath: string | null = null;

	if (vehiclePicture !== null) {
		const uploadResult = await replacePhoto(
			userId,
			vehiclePicture,
			'/uploads/vehicle_pictures',
			null
		);
		if (uploadResult !== null) {
			if (typeof uploadResult !== 'string') {
				return uploadResult;
			}
			vehiclePicturePath = uploadResult;
		}
	}
	return {
		luggage,
		passengers,
		color: hasColor ? color : null,
		model: hasModel ? model : null,
		smokingAllowed,
		licensePlate,
		vehiclePicturePath
	};
}
