import { KnownError } from '@idlebox/common';
import { findUpUntil } from '@idlebox/node';
import { stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import { inject, registerAuto } from './fs/dependency-injection/di';
import { IProgramArgs, IProgramEnvironment } from './fs/dependency-injection/tokens.generated';
import { mainProjectArg } from './program/arg.project';

interface IWithProject {
	readonly project: string;
}

@registerAuto()
export class Project {
	public declare readonly configFile: string;
	public declare readonly rootDir: string;
	public declare readonly secretFile: string;

	@inject(IProgramEnvironment)
	private declare readonly env: IProgramEnvironment;
	@inject(IProgramArgs)
	private declare readonly args: IProgramArgs<IWithProject>;

	async init() {
		// console.log('[project class] init');
		const inPath = resolve(this.env.INIT_CWD, this.args.require(mainProjectArg));
		let resolved: string;
		try {
			let s = await stat(inPath);
			if (s.isFile()) {
				resolved = inPath;
			} else {
				resolved = resolve(inPath, 'container.json');
				s = await stat(resolved);
				if (!s.isFile()) {
					throw new KnownError('can not read config file at: ' + resolved);
				}
			}
		} catch (e: any) {
			if (e.code !== 'ENOENT') throw e;
			throw new KnownError('missing config file at: ' + inPath);
		}
		if (!resolved) {
			const r = await findUpUntil(inPath, 'container.json');
			if (!r) throw new Error('container.json not found');
			resolved = r;
		}

		await this.env.initProject(dirname(resolved));

		const gitdir = await findUpUntil(inPath, '.git');
		if (!gitdir) {
			throw new Error('project not in git repository');
		}
		const rootDir = dirname(gitdir);

		const secretFile = resolve(rootDir, '.github/secrets.json');

		return { configFile: resolved, rootDir, secretFile };
	}
}
