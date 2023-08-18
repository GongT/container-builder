import { Options } from 'execa';
import { createInstance, inject, registerAuto } from '../../helpers/fs/dependency-injection/di';
import { IExecutable, IProgramEnvironment } from '../../helpers/fs/dependency-injection/tokens.generated';

@registerAuto()
export class GitTools {
	public readonly gitDir?: string;

	protected declare readonly exe: IExecutable<string>;

	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	async init(gitDir?: string) {
		const exe = await createInstance(IExecutable, 'git', {
			stdout: 'inherit',
			stderr: 'inherit',
			stdin: 'ignore',
			encoding: 'utf-8',
		});
		return { exe, gitDir };
	}

	async run(args: string[], options: Options = {}): Promise<any> {
		return await this.exe.execute(args, {
			env: {
				GIT_WORK_TREE: options.cwd as string,
				GIT_DIR: this.gitDir,
			},
			...options,
		});
	}

	async getOutput(cwd: string, args: string[], reject = true) {
		return this.exe.executeOutput(args, { stdout: 'pipe', reject, cwd });
	}
	async getOutputLines(cwd: string, args: string[], reject = true) {
		const r = await this.getOutput(cwd, args, reject);
		return r.split('\n').filter((e) => e.length > 0);
	}
	async getStatus(cwd: string, args: string[]) {
		const r = await this.run(args, { reject: false, cwd });
		return r.exitCode;
	}
}
