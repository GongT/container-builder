import { fromTimeStamp, getTimeStamp } from '@idlebox/common';
import { readFileIfExists, relativePath } from '@idlebox/node';
import { loadFile, saveFile } from '@idlebox/node-ignore-edit';
import { access, rm, writeFile } from 'fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'path';
import { inject, registerAuto } from '../../helpers/fs/dependency-injection/di';
import {
	ICiController,
	IGitTools,
	ILogger,
	IProgramEnvironment,
} from '../../helpers/fs/dependency-injection/tokens.generated';

@registerAuto()
export class GitGlobal {
	@inject(IGitTools)
	protected declare readonly git: IGitTools;

	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	@inject(ILogger)
	protected declare readonly logger: ILogger;

	@inject(ICiController)
	protected declare readonly ci: ICiController;

	async cloneOrUpdate(repoUrl: string, branch: string, to: string) {
		const group = this.ci.group(`git clone ${basename(repoUrl, '.git')}`);
		try {
			return await this._cloneOrUpdate(repoUrl, branch, to);
		} finally {
			group.dispose();
		}
	}
	private async _cloneOrUpdate(repoUrl: string, branch: string, to: string) {
		const tsFile = resolve(to, '.git/timestamp');
		this.logger.log(`url: ${repoUrl}`);
		this.logger.log(`branch: ${branch}`);
		this.logger.log(`target: ${to}`);

		try {
			await access(resolve(to, '.git/config'));
			const lines = await this.git.getOutputLines(to, ['for-each-ref', '--format=%(refname)', 'refs/heads/']);
			if (lines.length !== 1 || lines[0] !== `refs/heads/${branch}`) {
				throw new Error('invalid git repo: multiple or mismatch branch');
			}
		} catch (e: any) {
			if (e.code !== 'ENOENT') {
				this.logger.note(e.message);
				await rm(to, { recursive: true });
			}
			const cmd = [
				'clone',
				'--depth',
				'3',
				'--no-tags',
				'--recurse-submodules',
				'--shallow-submodules',
				'--branch',
				branch,
				'--single-branch',
				repoUrl,
				to,
			];
			await this.git.run(cmd, { cwd: dirname(to) });
			await writeFile(tsFile, getTimeStamp(new Date()).toFixed(0));
			return;
		}

		const ts = parseInt(await readFileIfExists(tsFile, 'utf-8'));
		const now = getTimeStamp(new Date());
		if (now < ts + 3600) {
			this.logger.log('skip update: cache have ' + (ts + 3600 - now) + 's left');
			return;
		}

		this.logger.log('check download: cache expired at ' + fromTimeStamp(ts + 3600).toISOString());

		await this.git.run(['submodule', 'update', '--recursive'], { cwd: to });
		await this.git.run(['submodule', 'update', '--recursive'], { cwd: to });
		await this.git.run(['submodule', 'sync', '--recursive'], { cwd: to });
		await this.git.run(['submodule', 'update', '--init', '--recursive'], { cwd: to });
		await this.git.run(['fetch', '--depth=3', '--no-tags', '--update-shallow', '--recurse-submodules'], {
			cwd: to,
		});
		await this.git.run(['reset', '--hard', `origin/${branch}`], { cwd: to });
		await writeFile(tsFile, getTimeStamp(new Date()).toFixed(0));
	}

	async ensureIgnore(name: string) {
		if (isAbsolute(name)) {
			const rel = relativePath(this.env.GIT_PROJECT_ROOT, name);
			if (rel.startsWith('../')) throw new Error(`can't add to ignore: out of project root: ${name} -> ${rel}`);
			name = rel;
		}
		const ignorefile = await loadFile(resolve(this.env.GIT_PROJECT_ROOT, '.gitignore'), true);
		if (ignorefile['builder']!.includes(name)) return;
		ignorefile['builder']!.push(name);

		this.logger.note(`add line [${name}] to ${this.env.GIT_PROJECT_ROOT}/.gitignore`);
		await saveFile(ignorefile);
	}
}
