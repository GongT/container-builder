import { registerGlobalLifecycle } from '@idlebox/common';
import { mkdir, open, rm } from 'fs/promises';
import { resolve } from 'path';
import { IProgramEnvironment } from './dependency-injection/tokens.generated';
import { inject, registerAuto } from './dependency-injection/di';
import { random } from './random';

@registerAuto()
export class TmpFile {
	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	async init() {
		await mkdir(this.env.HOME, { recursive: true });
		registerGlobalLifecycle(this);
	}

	async createTmpFile(name: string = `tmp.${random(3)}`) {
		const f = resolve(this.env.TMPDIR, name);
		return await open(f, 'wx');
	}
	async createTmpDir(name: string = `tmp.${random(3)}`) {
		const d = resolve(this.env.TMPDIR, name);
		await mkdir(d);
		return d;
	}

	async dispose() {
		await rm(this.env.TMPDIR, { recursive: true });
	}
}
