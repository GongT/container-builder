import { parse } from 'dotenv';
import { Options } from 'execa';
import { startProgram, startProgramJson } from '../../../helpers/functions/exec';
import { requireCommand } from '../../../helpers/program/environments';

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
	private readonly exe = requireCommand('systemctl');

	private run(args: string[]) {
		return startProgram(this.exe, ['--no-pager', ...args], execOpt);
	}
	private runJson(args: string[]) {
		return startProgramJson(this.exe, ['--no-pager', '--output', 'json', ...args], execOpt);
	}

	daemonReload() {
		return this.run(['daemon-reload']);
	}
	control(type: SystemControlKind, units: string[], wait = true) {
		const args = [type.toString()];
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
		const ret = await this.run(['show', '--no-pager', service, '--property', property.join(',')]);
		const obj: Record<keyof T, string> = parse(ret.stdout);
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
