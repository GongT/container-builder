import { resolve } from 'path';
import { createInstance, registerAuto } from '../../helpers/fs/dependency-injection/di';
import { IGitTools } from '../../helpers/fs/dependency-injection/tokens.generated';

@registerAuto()
export class GitRepo {
	protected declare readonly git: IGitTools;
	private declare readonly worktree: string;

	async init(worktree: string, gitDir: string = resolve(worktree, '.git')) {
		const git = await createInstance(IGitTools, gitDir);
		await git.run(['init']);
		return { worktree, git };
	}

	async getHasChange() {
		const r = await this.git.getStatus(this.worktree, ['diff-index', '--stat', 'HEAD']);
		return r !== 0;
	}
	async listFiles(folders: string[]) {
		const out = await this.git.getOutput(this.worktree, [
			'git',
			'ls-tree',
			'--name-only',
			'-r',
			'HEAD',
			...folders,
		]);
		return out.trim().split('\n');
	}
}
