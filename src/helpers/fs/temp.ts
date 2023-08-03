import { registerGlobalLifecycle, toDisposable } from '@idlebox/common';
import { mkdirSync } from 'fs';
import { mkdir, open, rm } from 'fs/promises';
import { resolve } from 'path';
import { TEMP_DIR } from '../program/environments';

export async function createTmpFile(name: string = `tmp.${random(3)}`) {
	register();
	const f = resolve(TEMP_DIR, name);
	const fd = await open(f, 'wx');
	fd.close();
	return f;
}
export async function createTmpDir(name: string = `tmp.${random(3)}`) {
	register();
	const d = resolve(TEMP_DIR, name);
	await mkdir(d);
	return d;
}

let registed = false;
function register() {
	if (registed) return;
	registed = true;

	mkdirSync(TEMP_DIR, { recursive: true });
	registerGlobalLifecycle(toDisposable(() => rm(TEMP_DIR, { recursive: true })));
}
export function random(length = 8) {
	return Math.random()
		.toString(36)
		.slice(2, 2 + length);
}
