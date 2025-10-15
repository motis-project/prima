import { fail } from '@sveltejs/kit';
import { msg } from '$lib/msg';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

export async function replacePhoto(
	userId: number | undefined,
	file: FormDataEntryValue | null,
	relativePath: string,
	oldPhoto: string | null
) {
	if (!userId) {
		return fail(403);
	}
	if (!(file instanceof File)) {
		return fail(400, { msg: msg('noFileUploaded') });
	}
	if (file.size === 0) {
		return null;
	}

	const maxSize = 10 * 1024 * 1024;
	if (file.size > maxSize) {
		return fail(400, { msg: msg('fileTooLarge') });
	}

	const base = `user_${userId}_${Date.now()}${crypto.randomUUID()}`;
	const hash = crypto.createHash('sha256').update(base).digest('hex');
	const fileName = hash.slice(0, 30) + '.jpg';
	const uploadDir = path.resolve(`static${relativePath}`);
	await fs.mkdir(uploadDir, { recursive: true });
	const filePath = path.join(uploadDir, fileName);

	const buffer = Buffer.from(await file.arrayBuffer());
	const detected = await fileTypeFromBuffer(buffer);
	const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

	if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
		fail(400, { msg: msg('invalidFileType') });
	}
	const resizedBuffer = await sharp(buffer)
		.resize({ width: 500, height: 500, fit: 'cover' })
		.toFormat('jpeg')
		.toBuffer();
	await fs.writeFile(filePath, resizedBuffer, { mode: 0o600 });

	const lookupPath = `${relativePath}/${fileName}`;

	if (oldPhoto !== null) {
		try {
			const oldFilePath = path.resolve(`static${oldPhoto}`);
			await fs.unlink(oldFilePath);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
				console.error('Failed to delete old profile picture:', err);
			}
		}
	}

	return lookupPath;
}
