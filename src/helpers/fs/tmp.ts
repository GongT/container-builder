import { registerGlobalLifecycle } from '@idlebox/common';
import { mkdir, open, rm } from 'fs/promises';
import { resolve } from 'path';
import { inject, registerAuto } from './dependency-injection/di';
import { ILogger, IProgramEnvironment } from './dependency-injection/tokens.generated';
import { random } from './random';

@registerAuto()
export class TmpFile {
	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	@inject(ILogger)
	protected declare readonly logger: ILogger;

	async init() {
		await mkdir(this.env.HOME, { recursive: true });
		registerGlobalLifecycle(this);
	}

	getTmpFile(name: string = `tmp.${random(3)}`) {
		return resolve(this.env.TMPDIR, name);
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
		if (process.env.NO_REMOTE_TEMPDIR === 'yes') {
			this.logger.note('[NO_REMOTE_TEMPDIR=yes] temporary directory not delete: %s', this.env.TMPDIR);
		} else {
			this.logger.debug(
				'remove temporary directory: %s (set env.NO_REMOTE_TEMPDIR=yes to skip)',
				this.env.TMPDIR
			);
			await rm(this.env.TMPDIR, { recursive: true });
		}
	}
}
