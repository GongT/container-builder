import { format } from 'util';
import { registerAuto } from '../fs/dependency-injection/di';
import { isDebug } from './lifecycle';

export function bail(msg: string): never {
	process.stderr.write('\x1B[38;5;9m[Fatal] ' + msg + '\x1B[0m', () => {
		process.exit(1);
	});
	throw new Error('bail');
}

@registerAuto()
export class Logger {
	private _indentStr = '';
	private readonly groups: string[] = [];

	indent(title: string) {
		this.groups.push(title);
		this._indentStr = '\t'.repeat(this.groups.length);
	}
	dedent(title: string) {
		const last = this.groups.pop();
		if (last !== title) {
			throw new Error(`invalid group, pop ${title}, current is ${last}`);
		}
		this._indentStr = '\t'.repeat(this.groups.length);
	}

	log(msg: string, ...args: any[]) {
		process.stderr.write(this.format(msg, args) + '\n');
	}
	error(msg: string, ...args: any[]) {
		process.stderr.write('\x1B[38;5;9m' + this.format(msg, args) + '\x1B[0m\n');
	}
	success(msg: string, ...args: any[]) {
		process.stderr.write('\x1B[38;5;10m' + this.format(msg, args) + '\x1B[0m\n');
	}
	warn(msg: string, ...args: any[]) {
		process.stderr.write('\x1B[38;5;11m' + this.format(msg, args) + '\x1B[0m\n');
	}
	info(msg: string, ...args: any[]) {
		process.stderr.write('\x1B[38;5;14m' + this.format(msg, args) + '\x1B[0m\n');
	}
	debug(msg: string, ...args: any[]) {
		if (isDebug) {
			process.stderr.write('\x1B[2m' + this.format(msg, args).replace(/^/gm, '..DBG.. ') + '\x1B[0m\n');
		}
	}
	note(msg: string, ...args: any[]) {
		process.stderr.write('\x1B[2m' + this.format(msg, args) + '\x1B[0m\n');
	}
	die(msg: string, ...args: any[]): never {
		bail(this.format(msg, args));
	}

	private format(msg: string, args: any[]) {
		if (args.length === 0) return msg;
		return format(msg, ...args).replace(/^/gm, this._indentStr);
	}
}
