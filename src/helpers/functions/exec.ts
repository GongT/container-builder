import { commandInPath } from '@idlebox/node';
import { ExecaChildProcess, ExecaReturnValue, Options, execa } from 'execa';
import { isAbsolute } from 'path';
import { inject, registerAuto } from '../fs/dependency-injection/di';
import { IExecuter } from '../fs/dependency-injection/tokens.generated';

export class ExecuteError extends Error {
	constructor(
		message: string,
		readonly command: string,
		readonly code: number = -1,
		readonly stderr: string = ''
	) {
		super(`${message} (execute ${command})`);
	}
}

function fmt(cmd: string, args: string[]) {
	return [cmd, ...args].map((e) => JSON.stringify(e)).join(' ');
}

declare type NotReadonly<T> = {
	-readonly [K in keyof T]: T[K];
};

@registerAuto()
export class Executer {
	/**
	 * execute and JSON.parse result
	 */
	async executeJson(cmd: string, args: string[], opt: Omit<Options, 'encoding'>): Promise<any> {
		const result = await this.execute<string>(cmd, args, { ...opt, encoding: 'utf-8' });
		try {
			return JSON.parse(result.stdout);
		} catch {
			throw new ExecuteError('invalid json output', fmt(cmd, args), result.exitCode, result.stdout);
		}
	}

	/**
	 * execute and return string
	 */
	async executeOutput<EncodingType extends string | undefined>(
		cmd: string,
		args: string[],
		opt: OptionsTypeOf<EncodingType>
	): Promise<OutputTypeOf<EncodingType>> {
		if (opt.stdout || opt.stdio?.[1]) {
			throw new Error('invalid call to executeOutput');
		}
		const result = await this.execute(cmd, args, { ...opt, stdout: 'pipe' });
		return result.stdout as any;
	}

	/**
	 * execute return Successful Completed process object
	 */
	async execute<EncodingType extends string | undefined>(
		cmd: string,
		args: string[],
		opt: OptionsTypeOf<EncodingType>
	): Promise<ExecaReturnValue<OutputTypeOf<EncodingType>>> {
		const result = await this.executeRaw(cmd, args, opt);
		this.handleRaw(cmd, args, result);
		return result;
	}

	/**
	 * handle raw process object result
	 */
	handleRaw(cmd: string, args: string[], child: ExecaReturnValue<any>) {
		if (child.signal) {
			throw new ExecuteError(
				'program killed by signal ' + child.signal,
				fmt(cmd, args),
				child.exitCode,
				child.stderr?.toString() ?? '<no stderr>'
			);
		}
		if (child.exitCode !== 0) {
			throw new ExecuteError(
				'program exit with code ' + child.exitCode,
				fmt(cmd, args),
				child.exitCode,
				child.stderr?.toString() ?? '<no stderr>'
			);
		}
		if (child.failed) {
			throw new ExecuteError(
				'can not execute',
				fmt(cmd, args),
				child.exitCode,
				child.stderr?.toString() ?? '<no stderr>'
			);
		}
	}

	/**
	 * execute return process object, not handle error, not completed
	 */
	executeRaw<EncodingType extends string | undefined>(
		cmd: string,
		args: string[],
		opt: OptionsTypeOf<EncodingType>
	): ExecaChildProcess<OutputTypeOf<EncodingType>> {
		process.stderr.write(`\x1B[2m + ${fmt(cmd, args)}\x1B[0m\n`);
		opt = { encoding: null as any, ...opt, reject: false };

		if (!opt.stdio && !opt.stdout && !opt.stderr) {
			opt = { ...opt, stdio: ['ignore', 'inherit', 'inherit'] };
		}

		return execa(cmd, args, opt) as ExecaChildProcess<any>;
	}
}

type OptionsTypeOf<EncodingType = undefined> = EncodingType extends undefined
	? Omit<Options, 'encoding'>
	: Options<string>;
type OutputTypeOf<EncodingType = undefined> = EncodingType extends undefined ? Buffer : string;

@registerAuto()
export class Executable<EncodingType extends string | undefined = undefined> {
	@inject(IExecuter).optional()
	private declare readonly service: IExecuter;
	private declare readonly command: string;
	private readonly defaultOptions?: Options;

	async init(command: string, options?: OptionsTypeOf<EncodingType>) {
		const absolute = isAbsolute(command) ? command : await commandInPath(command);
		return { command: absolute, defaultOptions: options };
	}

	applyOptions(opt?: OptionsTypeOf<EncodingType>): OptionsTypeOf<EncodingType>;
	applyOptions<ET extends string | undefined>(opt?: OptionsTypeOf<ET>): OptionsTypeOf<ET>;
	applyOptions(opt?: OptionsTypeOf<any>): OptionsTypeOf<any> {
		let env = this.defaultOptions?.env || {};
		if (opt?.env) {
			env = Object.assign({}, env, opt.env);
		}
		return Object.assign({}, this.defaultOptions, opt, { shell: false, env });
	}

	async executeOutput<ET extends string | undefined = EncodingType>(
		args: string[],
		opt?: OptionsTypeOf<ET>
	): Promise<OutputTypeOf<ET>> {
		opt = this.applyOptions(opt);
		return this.service.executeOutput(this.command, args, opt);
	}

	executeJson(args: string[], opt?: Omit<Options, 'encoding'>): Promise<any> {
		opt = this.applyOptions(opt);
		return this.service.executeJson(this.command, args, opt);
	}

	execute<ET extends string | undefined = EncodingType>(
		args: string[],
		opt?: OptionsTypeOf<ET>
	): Promise<ExecaReturnValue<OutputTypeOf<ET>>> {
		opt = this.applyOptions(opt);
		return this.service.execute(this.command, args, opt);
	}

	handleRaw(args: string[], child: ExecaReturnValue<any>) {
		return this.service.handleRaw(this.command, args, child);
	}

	executeRaw(args: string[], opt?: OptionsTypeOf<EncodingType>): ExecaChildProcess<OutputTypeOf<EncodingType>>;
	executeRaw<ET extends string | undefined>(
		args: string[],
		opt?: OptionsTypeOf<ET>
	): ExecaChildProcess<OutputTypeOf<ET>>;
	executeRaw<ET extends string | undefined = EncodingType>(
		args: string[],
		opt?: OptionsTypeOf<ET>
	): ExecaChildProcess<OutputTypeOf<ET>> {
		opt = this.applyOptions(opt);
		return this.service.executeRaw(this.command, args, opt);
	}
}
