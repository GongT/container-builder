import { registerGlobalLifecycle } from '@idlebox/common';
import { readFile } from 'fs/promises';
import { basename, dirname } from 'path';
import { ensureExec } from '../../helpers/fs/helper';
import { createTmpFile } from '../../helpers/fs/temp';
import { Buildah } from './buildah';
import { shortId } from './share';

interface ICopyArgs {
	executable?: true;
	chown?: string;
	from?: string;
}

export class BuildahStep extends Buildah {
	private _containerId?: string;

	constructor(private readonly imageName: string) {
		super();
		registerGlobalLifecycle(this);
	}

	async dispose() {
		if (this._containerId) {
			await this.run(['rm', this._containerId]);
		}
	}

	async start(name: string) {
		const tmpf = await createTmpFile();
		await this.run(['from', this.imageName, `--cidfile=${tmpf}`, `--name=${name}`, '--pull=never']);
		const cid = await readFile(tmpf, 'utf-8');
		this._containerId = shortId(cid);
		return this._containerId;
	}

	async executeCommand(cmds: string[], contextDir?: string) {
		if (!this._containerId) throw new Error('container not started');

		const args = ['run', '--no-hosts', '--mount=type=tmpfs,tmpfs-size=1G,destination=/tmp'];
		if (contextDir) {
			args.push(`--mount=type=bind,ro,src=${contextDir},destination=/tmp/context`, '--workingdir=/tmp/context');
		} else {
			args.push('--workingdir=/tmp');
		}
		args.push(...cmds);
		await this.run(args);
	}
	async executeScriptFile(file: string) {
		await ensureExec(file);
		await this.executeCommand([`./${basename(file)}`], dirname(file));
	}
	async copyFiles(src: string, dest: string, options: ICopyArgs = {}) {
		if (!this._containerId) throw new Error('container not started');

		const args = ['copy'];
		if (options.chown) args.push(`--chown=${options.chown}`);
		if (options.from) args.push(`--from=${options.from}`);
		if (options.executable) args.push('--chmod=0755');
		args.push(this._containerId, src, dest);
		this.run(args);
	}
}

// export interface IBuildExecOptions {}
