import { registerGlobalLifecycle } from '@idlebox/common';
import { appendFile } from 'fs/promises';
import { format } from 'util';
import { IS_CI } from '../program/environments';

export function bail(msg: string): never {
	console.error('\x1B[38;5;9m' + msg + '\x1B[0m');
	process.exit(1);
}

class Logger {
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
		console.error(this._indentStr + this.format(msg, args));
	}
	error(msg: string, ...args: any[]) {
		console.error(this._indentStr + '\x1B[38;5;9m' + this.format(msg, args) + '\x1B[0m');
	}
	success(msg: string, ...args: any[]) {
		console.error(this._indentStr + '\x1B[38;5;10m' + this.format(msg, args) + '\x1B[0m');
	}
	warn(msg: string, ...args: any[]) {
		console.error(this._indentStr + '\x1B[38;5;11m' + this.format(msg, args) + '\x1B[0m');
	}
	info(msg: string, ...args: any[]) {
		console.error(this._indentStr + '\x1B[38;5;14m' + this.format(msg, args) + '\x1B[0m');
	}
	note(msg: string, ...args: any[]) {
		console.error(this._indentStr + '\x1B[2m' + this.format(msg, args) + '\x1B[0m');
	}
	die(msg: string, ...args: any[]) {
		bail(this.format(msg, args));
	}

	private format(msg: string, args: any[]) {
		if (args.length === 0) return msg;
		return format(msg, ...args);
	}
}

export const logger = new Logger();

class CiController {
	private readonly appendEnv: { name: string; value: string }[] = [];

	constructor(private readonly logger: Logger) {
		if (IS_CI) {
			registerGlobalLifecycle(this);
		} else {
			this.logger.note('not in CI, skip lifecycles');
		}
	}

	emitError(message: string) {
		if (IS_CI) {
			console.error(`::error ::${message}`);
		} else {
			this.logger.warn(message);
		}
	}

	export(name: string, value: string) {
		process.env[name] = value;
		this.appendEnv.push({ name, value });
	}
	group(title: string) {
		if (IS_CI) {
			console.error(`::group::${title}`);
		} else {
			this.logger.info(`[Start Group] ${title}`);
		}
		this.logger.indent(title);
	}

	groupEnd(title: string) {
		if (IS_CI) {
			console.error(`::endgroup::`);
		}
		this.logger.dedent(title);
	}

	async dispose() {
		this.logger.note('saving environments: %s items', this.appendEnv.length);
		if (this.appendEnv.length) {
			let text = '';
			for (const { name, value } of this.appendEnv) {
				text += `${name}<<EOF\n${value}\nEOF\n`;
			}
			await appendFile(process.env.GITHUB_ENV!, text);
		}
	}
}
export const ci = new CiController(logger);
