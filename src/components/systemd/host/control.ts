import { parse } from 'dotenv';
import { Options } from 'execa';
import { createInstance, inject } from '../../../helpers/fs/dependency-injection/di';
import { IExecutable, IProgramEnvironment } from '../../../helpers/fs/dependency-injection/tokens.generated';

const execOpt: Options = {
	all: true,
	stderr: 'pipe',
	stdout: 'pipe',
	stdin: 'ignore',
	shell: false,
	stripFinalNewline: true,
	encoding: 'utf-8',
};

export enum SystemControlKind {
	start = 'start',
	restart = 'restart',
	stop = 'stop',
	enable = 'enable',
	disable = 'disable',
}

class SystemControl {
	@inject(IProgramEnvironment)
	protected declare readonly env: IProgramEnvironment;

	private declare readonly exe: IExecutable<string>;
	async init() {
		const exe = await createInstance(IExecutable, 'systemctl', { encoding: 'utf-8' });
		return { exe };
	}

	private runOut(args: string[]) {
		return this.exe.executeOutput(['--no-pager', ...args], execOpt);
	}

	private async run(args: string[]) {
		await this.exe.executeOutput(['--no-pager', ...args], execOpt);
	}
	private runJson(args: string[]) {
		return this.exe.executeJson(['--no-pager', '--output', 'json', ...args], execOpt);
	}

	daemonReload() {
		return this.run(['daemon-reload']);
	}
	control(type: SystemControlKind, units: string[], wait = true) {
		const args: string[] = [SystemControlKind[type]];
		if (wait) {
			args.push('--wait');
		} else {
			args.push('--no-block');
		}
		args.push(...units);
		return this.run(args);
	}

	async status(service: string, property: string): Promise<string | undefined>;
	async status<T>(service: string, ...property: (keyof T)[]): Promise<Record<keyof T, string | undefined>>;
	async status<T>(service: string, ...property: (keyof T)[]) {
		const ret = await this.runOut(['show', '--no-pager', service, '--property', property.join(',')]);
		const obj: Record<keyof T, string> = parse(ret);
		if (property.length === 1) {
			return Object.values(obj)[0];
		} else {
			return obj;
		}
	}
	listUnits() {
		return this.runJson(['list-units']);
	}
	listUnitFiles() {
		return this.runJson(['list-units']);
	}
}

export const systemctl = new SystemControl();
