import { chmod, stat } from 'fs/promises';

export async function ensureExec(file: string) {
	const s = await stat(file);
	if (!s.isFile()) throw new Error('not a file: ' + file);
	if ((s.mode & 0o111) === 0o111) return;

	const mode = s.mode | 0o111;
	await chmod(file, mode);
}
