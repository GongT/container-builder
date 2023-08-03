import { type Options } from 'execa';
import { resolve } from 'path';
import { startProgram } from '../../helpers/functions/exec';
import { requireCommand } from '../../helpers/program/environments';

export class GitRepo {
	private readonly exe = requireCommand('git');

	constructor(
		private readonly worktree: string,
		private readonly gitDir: string = resolve(worktree, '.git')
	) {}

	private async getOutput(args: string[]) {
		const r = await this.run(args, { stdout: 'pipe' });
		return r.stdout;
	}
	private async getSuccess(args: string[]) {
		const r = await this.run(args, { reject: false });
		return r.exitCode === 0;
	}
	private run(args: string[], options: Options = {}) {
		return startProgram(this.exe, args, {
			stdout: 'inherit',
			stderr: 'inherit',
			stdin: 'ignore',
			shell: false,
			encoding: 'utf-8',
			env: {
				GIT_WORK_TREE: this.worktree,
				GIT_DIR: this.gitDir,
			},
			...options,
		});
	}

	async init() {
		await this.run(['init']);
	}

	async getHasChange() {
		
	}
}
